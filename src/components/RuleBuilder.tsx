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

function ruleValue(r: DraftRule): string {
  if (r.pct != null) return `${r.pct}%`;
  if (r.amount != null) return `₹${r.amount.toLocaleString("en-IN")}`;
  return "Required";
}

const KIND_TITLE: Record<string, string> = {
  min_category_pct: "Minimum allocation",
  max_category_amount: "Spending cap",
  requires_invoice: "Invoice required",
  manual_approval_above: "Manual approval",
  refund_unused: "Refund unused",
  forbidden_category: "Not permitted",
};

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
  const [dragging, setDragging] = useState(false);
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

  const step = locked ? 4 : rules ? 3 : 1;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: rules ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)", gap: 28, alignItems: "start" }}>
        {/* ── Left: upload / agreement ── */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
            <span className="serif" style={{ fontSize: 22, color: "var(--brand)" }}>01</span>
            <div style={{ borderLeft: "1px solid var(--border-strong)", paddingLeft: 14 }}>
              <h3 className="display" style={{ fontSize: 22 }}>Upload signed MOU</h3>
              <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4, maxWidth: 440 }}>
                Add the final agreement (PDF or image), or paste it below. Gemma extracts the key terms and
                turns them into enforceable treasury rules.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span className="label">Campaign name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <span className="label">Organiser</span>
              <input className="input" value={organiser} onChange={(e) => setOrganiser(e.target.value)} />
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) readMou(e.dataTransfer.files[0]); }}
            style={{
              marginTop: 14,
              border: `1.5px dashed ${dragging ? "var(--brand)" : "var(--brand-2)"}`,
              background: dragging ? "var(--pink)" : "var(--panel-2)",
              borderRadius: 16, padding: "34px 20px", textAlign: "center", cursor: "pointer",
              transition: "background 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 999, margin: "0 auto 12px",
              background: "var(--pink)", display: "grid", placeItems: "center", fontSize: 24,
            }}>📄</div>
            <div className="serif" style={{ fontSize: 18 }}>
              {mouBusy ? "Gemma is reading the document…" : dragging ? "Release to upload" : "Drop your MOU here"}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>PDF or image, up to 25 MB</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px auto 0", maxWidth: 320, color: "var(--muted)", fontSize: 12 }}>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} /> or <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
              Upload signed MOU
            </button>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) readMou(e.target.files[0]); }} />
          </div>

          {mouInfo && (
            <div className="chip" style={{ marginTop: 10, color: "var(--ok)", borderColor: "var(--ok)" }}>
              {mouInfo.source === "gemma" ? "Read by Gemma" : "Uploaded"}: {mouInfo.filename}
              {mouInfo.driveLink && <> · <a href={mouInfo.driveLink} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>view in Drive ↗</a></>}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <span className="label">Agreement text (editable)</span>
            <textarea className="textarea" rows={8} value={doc} onChange={(e) => setDoc(e.target.value)} style={{ fontFamily: "var(--serif)", fontSize: 14.5, lineHeight: 1.6 }} />
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy || !doc.trim()} onClick={extract}>
            {busy ? "Reading…" : "Extract rules with Gemma  →"}
          </button>
        </div>

        {/* ── Right: extracted rules ── */}
        {rules && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span className="serif" style={{ fontSize: 22, color: "var(--brand)" }}>02</span>
                <div style={{ borderLeft: "1px solid var(--border-strong)", paddingLeft: 14 }}>
                  <h3 className="display" style={{ fontSize: 22 }}>Extract with Gemma</h3>
                  <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4, maxWidth: 400 }}>
                    Review the extracted rules. Remove anything that doesn’t belong, then confirm to lock them.
                  </p>
                </div>
              </div>
              <span className="serif" style={{ fontSize: 18, color: "var(--brand)", whiteSpace: "nowrap" }}>{rules.length} rules found</span>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              {rules.map((r, i) => (
                <div key={r.id} style={{
                  display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 14, alignItems: "center",
                  padding: "16px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  background: i % 2 ? "var(--panel-2)" : "transparent",
                }}>
                  <span className="serif" style={{ fontSize: 15, color: "var(--muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="eyebrow" style={{ color: "var(--muted)", marginBottom: 3 }}>{KIND_TITLE[r.kind] ?? r.kind}</div>
                    <div style={{ color: "var(--text)", fontSize: 14.5 }}>{r.label}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="serif" style={{ fontSize: 16, color: "var(--brand)", background: "var(--pink)", padding: "4px 12px", borderRadius: 8, whiteSpace: "nowrap" }}>
                      {ruleValue(r)}
                    </span>
                    <button className="btn btn-danger" style={{ padding: "5px 11px", fontSize: 13 }} disabled={locked}
                      onClick={() => setRules((prev) => prev!.filter((x) => x.id !== r.id))}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span className="chip" style={{ color: "var(--brand)", borderColor: "var(--brand-2)" }}>
                ✦ {source === "gemma" ? "Extracted by Gemma" : "Deterministic fallback"}
              </span>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={busy || locked || rules.length === 0} onClick={confirm}>
                {locked ? "✓ Rules locked & anchored" : "Confirm & lock rules  →"}
              </button>
              {locked && <Link className="btn" href="/">Go to dashboard →</Link>}
            </div>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 36, borderTop: "1px solid var(--border)", paddingTop: 20, flexWrap: "wrap" }}>
        {[
          { n: 1, title: "Upload", sub: "Add signed MOU" },
          { n: 2, title: "Extract", sub: "With Gemma" },
          { n: 3, title: "Review", sub: "Edit & confirm" },
          { n: 4, title: "Lock", sub: "Activate in treasury" },
        ].map((s, i) => {
          const done = step > s.n || (s.n === 4 && locked);
          const active = step === s.n;
          return (
            <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600,
                  background: done || active ? "var(--brand)" : "var(--panel-2)",
                  color: done || active ? "#fdeef2" : "var(--muted)",
                  border: active ? "2px solid var(--brand)" : "1px solid var(--border)",
                }}>{done ? "✓" : s.n}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: done || active ? "var(--text)" : "var(--muted)" }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.sub}</div>
                </div>
              </div>
              {i < 3 && <span style={{ width: 48, height: 1, background: "var(--border)", margin: "0 18px" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
