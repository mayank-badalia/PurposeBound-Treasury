"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface FileEntry {
  file: File;
  type: string;
  previewUrl?: string;
}

export default function ExpenseForm({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [category, setCategory] = useState("catering");
  const [amount, setAmount] = useState(12000);
  const [vendor, setVendor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; id?: string; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const entries: FileEntry[] = Array.from(list).map((file) => ({
      file,
      type: file.type.startsWith("image/") ? "photo" : "invoice",
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("campaignId", campaignId);
      fd.set("category", category);
      fd.set("amount", String(amount));
      fd.set("vendor", vendor);
      fd.set("recipient", recipient);
      fd.set("description", description);
      for (const f of files) {
        fd.append("files", f.file);
        fd.append("types", f.type);
      }
      const res = await fetch("/api/expenses", { method: "POST", body: fd });
      const j = await res.json();
      setResult(j.ok ? { ok: true, id: j.expense.id } : { ok: false, error: j.error });
      if (j.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const runReview = async (id: string) => {
    await fetch(`/api/expenses/${id}/review`, { method: "POST" });
    router.push("/approvals");
  };

  return (
    <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <span className="label">Campaign</span>
          <select className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.length === 0 && <option value="">No campaigns — load demo data first</option>}
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Category</span>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="catering, venue, marketing…" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <span className="label">Amount (₹)</span>
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div>
          <span className="label">Vendor</span>
          <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="FreshBite Catering" />
        </div>
        <div>
          <span className="label">Payment recipient</span>
          <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="(defaults to vendor)" />
        </div>
      </div>

      <div>
        <span className="label">Description</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />
      </div>

      {/* Photo / document upload */}
      <div>
        <span className="label">Evidence — invoices, receipts & photos</span>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", color: "var(--muted)" }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)" }}>📷 Upload a photo or document</div>
          <div style={{ fontSize: 13 }}>Click or drop files (images or PDF). Gemma reads them to verify the claim.</div>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {files.map((f, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 8, width: 150 }}>
                {f.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.previewUrl} alt={f.file.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6 }} />
                ) : (
                  <div style={{ height: 80, display: "grid", placeItems: "center", background: "var(--panel-2)", borderRadius: 6, fontSize: 28 }}>📄</div>
                )}
                <div style={{ fontSize: 11, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.file.name}</div>
                <select className="select" style={{ padding: "4px 6px", fontSize: 12, marginTop: 4 }} value={f.type}
                  onChange={(e) => setFiles((prev) => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}>
                  <option value="invoice">invoice</option>
                  <option value="receipt">receipt</option>
                  <option value="photo">photo</option>
                  <option value="completion">completion</option>
                </select>
                <button className="btn btn-danger" style={{ padding: "3px 8px", fontSize: 11, marginTop: 4, width: "100%" }}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy || !campaignId || !vendor || !amount} onClick={submit}>
          {busy ? "Submitting…" : "Submit expense"}
        </button>
        {result?.ok && result.id && (
          <>
            <span className="chip" style={{ color: "var(--ok)" }}>Submitted & hash-anchored</span>
            <button className="btn" onClick={() => runReview(result.id!)}>Run 4-agent review →</button>
          </>
        )}
        {result && !result.ok && <span className="chip" style={{ color: "var(--danger)" }}>{result.error}</span>}
      </div>
    </div>
  );
}
