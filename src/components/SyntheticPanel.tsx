"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inr, RECOMMENDATION_LABEL, VERIFICATION_LABEL } from "@/lib/format";

interface ScenarioResult {
  expenseId: string;
  scenario: string;
  category: string;
  amount: number;
  expected: { verification: string; recommendation: string };
  actual: { verification: string; recommendation: string };
  anomalyScore: number;
  pass: boolean;
  rationale: string;
}
interface Summary {
  campaignId: string;
  total: number;
  passed: number;
  failed: number;
  results: ScenarioResult[];
}

const ALL_TYPES = [
  "clean",
  "prize_breach",
  "duplicate",
  "over_limit",
  "not_permitted",
  "missing_invoice",
];

export default function SyntheticPanel({ campaigns }: { campaigns: { id: string; name: string; synthetic: boolean }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [seed, setSeed] = useState("demo-seed-1");
  const [size, setSize] = useState(12);
  const [types, setTypes] = useState<string[]>(ALL_TYPES);
  const [targetCampaign, setTargetCampaign] = useState("");

  const post = (body: object) =>
    fetch("/api/synthetic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const act = async (key: string, body: object, after?: (j: Record<string, unknown>) => void) => {
    setBusy(key);
    try {
      const res = await post(body);
      const j = await res.json();
      after?.(j);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Fixed dataset */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Fixed demonstration dataset</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Stable, always-identical — 6 scenarios with stored expected outcomes. Use this to demo.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={!!busy}
            onClick={() => act("fixed", { action: "reset_and_seed_fixed" }, (j) => setTargetCampaign(String(j.campaignId ?? "")))}>
            {busy === "fixed" ? "Loading…" : "Reset & load fixed dataset"}
          </button>
          <a className="btn" href="/api/synthetic?download=fixed">Download fixed dataset (JSON)</a>
        </div>
      </div>

      {/* Generator */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Seeded generator</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Fresh, reproducible data. Same seed → same dataset. Pick size and which scenario types to include.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 420 }}>
          <div>
            <span className="label">Seed</span>
            <input className="input" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </div>
          <div>
            <span className="label">Size (expenses)</span>
            <input className="input" type="number" min={1} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
          {ALL_TYPES.map((t) => (
            <button key={t} className="chip" onClick={() => toggleType(t)}
              style={{ cursor: "pointer", opacity: types.includes(t) ? 1 : 0.4, borderColor: types.includes(t) ? "var(--brand)" : "var(--border)" }}>
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={!!busy || types.length === 0}
            onClick={() => act("gen", { action: "generate", seed, size, scenarioTypes: types }, (j) => setTargetCampaign(String(j.campaignId ?? "")))}>
            {busy === "gen" ? "Generating…" : "Generate dataset"}
          </button>
          <a className="btn" href={`/api/synthetic?download=generated&seed=${encodeURIComponent(seed)}&size=${size}`}>Download generated (JSON)</a>
        </div>
      </div>

      {/* Validation */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Validate: input → output → expected</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Runs every scenario through the real 4-agent pipeline and compares the actual result to the stored
          expected outcome. A pass means the result is <em>correct</em>, not just error-free.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <span className="label">Campaign</span>
            <select className="select" value={targetCampaign} onChange={(e) => setTargetCampaign(e.target.value)} style={{ minWidth: 260 }}>
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!!busy || !targetCampaign}
            onClick={() => act("val", { action: "validate", campaignId: targetCampaign }, (j) => setSummary((j.summary as Summary) ?? null))}>
            {busy === "val" ? "Validating…" : "Run validation"}
          </button>
        </div>

        {summary && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <span className="chip" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>Passed {summary.passed}/{summary.total}</span>
              {summary.failed > 0 && <span className="chip" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Failed {summary.failed}</span>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={th}>Scenario</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Expected</th>
                    <th style={th}>Actual</th>
                    <th style={th}>Anomaly</th>
                    <th style={th}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.map((r) => (
                    <tr key={r.expenseId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>{r.scenario}<div style={{ color: "var(--muted)", fontSize: 11 }}>{r.category}</div></td>
                      <td style={td}>{inr(r.amount)}</td>
                      <td style={td}>
                        <div>{VERIFICATION_LABEL[r.expected.verification]}</div>
                        <div style={{ color: "var(--muted)", fontSize: 11 }}>{RECOMMENDATION_LABEL[r.expected.recommendation]}</div>
                      </td>
                      <td style={td}>
                        <div>{VERIFICATION_LABEL[r.actual.verification]}</div>
                        <div style={{ color: "var(--muted)", fontSize: 11 }}>{RECOMMENDATION_LABEL[r.actual.recommendation]}</div>
                      </td>
                      <td style={td}>{r.anomalyScore}</td>
                      <td style={{ ...td, color: r.pass ? "var(--ok)" : "var(--danger)", fontWeight: 800 }}>
                        {r.pass ? "PASS" : "FAIL"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
