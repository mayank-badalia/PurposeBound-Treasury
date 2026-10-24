"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface DraftRule {
  id: string;
  kind: string;
  label: string;
  category?: string;
  pct?: number;
  amount?: number;
  confirmed: boolean;
  source: string;
}

const SAMPLE = `SPONSORSHIP AGREEMENT — Innovate Hackathon 2026.
TechCorp sponsors ₹2,00,000 for the event.
At least 40% of funds must be used for prizes.
Marketing expenses cannot exceed ₹20,000.
All vendor payments require a valid invoice.
Expenses above ₹25,000 require manual approval.
Alcohol is not a permitted expense.
Unused funds must be refunded to the sponsor.`;

export default function RuleBuilder() {
  const router = useRouter();
  const [name, setName] = useState("Innovate Hackathon 2026");
  const [organiser, setOrganiser] = useState("Innovate Student Council");
  const [doc, setDoc] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [rules, setRules] = useState<DraftRule[] | null>(null);
  const [source, setSource] = useState<string>("");
  const [locked, setLocked] = useState(false);
  const [mouBusy, setMouBusy] = useState(false);
  const [mouInfo, setMouInfo] = useState<{ filename: string; source: string; driveLink?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readMou = async (file: File) => {
    setMouBusy(true);
    setMouInfo(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/mou/read", { method: "POST", body: fd });
      const j = await res.json();
      if (j.ok) {
        if (j.text) setDoc(j.text);
        setMouInfo({ filename: j.filename, source: j.source, driveLink: j.driveLink });
      }
    } finally {
      setMouBusy(false);
    }
  };

  const extract = async () => {
    setBusy(true);
    setLocked(false);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, organiser, sourceDocument: doc }),
      });
      const j = await res.json();
      if (j.ok) {
        setCampaignId(j.campaign.id);
        setRules(j.draftRules);
        setSource(j.source);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!campaignId || !rules) return;
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      setLocked(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <span className="label">Campaign name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="label">Organiser</span>
            <input className="input" value={organiser} onChange={(e) => setOrganiser(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <span className="label">Upload MOU / agreement (image or PDF) — or paste below</span>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) readMou(e.dataTransfer.files[0]); }}
            style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", color: "var(--muted)" }}
          >
            <div style={{ fontWeight: 700, color: "var(--text)" }}>📄 {mouBusy ? "Gemma is reading the document…" : "Upload MOU (image / PDF)"}</div>
            <div style={{ fontSize: 13 }}>Gemma transcribes it into the box below; the original is saved to Google Drive.</div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) readMou(e.target.files[0]); }} />
          </div>
          {mouInfo && (
            <div className="chip" style={{ marginTop: 8, color: "var(--ok)", borderColor: "var(--ok)" }}>
              {mouInfo.source === "gemma" ? "Read by Gemma" : "Uploaded"}: {mouInfo.filename}
              {mouInfo.driveLink && <> · <a href={mouInfo.driveLink} target="_blank" rel="noreferrer" style={{ color: "var(--brand-2)" }}>view in Drive ↗</a></>}
            </div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <span className="label">Funding agreement / proposal / budget (editable)</span>
          <textarea className="textarea" rows={9} value={doc} onChange={(e) => setDoc(e.target.value)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" disabled={busy || !doc.trim()} onClick={extract}>
            {busy ? "Reading…" : "Extract spending rules with Gemma"}
          </button>
        </div>
      </div>

      {rules && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Proposed rules</div>
            <span className="chip">{source === "gemma" ? "Gemma" : "deterministic fallback"} · {rules.length} rules</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 12px" }}>
            Review before accepting funds. Remove anything that does not belong; the confirmed set is hash-anchored.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }} className="mono">{r.kind}{r.category ? ` · ${r.category}` : ""}{r.pct != null ? ` · ${r.pct}%` : ""}{r.amount != null ? ` · ₹${r.amount.toLocaleString("en-IN")}` : ""}</div>
                </div>
                <button className="btn btn-danger" style={{ padding: "5px 10px" }} disabled={locked}
                  onClick={() => setRules((prev) => prev!.filter((x) => x.id !== r.id))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy || locked || rules.length === 0} onClick={confirm}>
              {locked ? "✓ Rules locked & anchored" : "Confirm & lock rules"}
            </button>
            {locked && <Link className="btn" href="/">Go to dashboard →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
