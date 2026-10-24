import type { AgentReview } from "@/lib/types";
import { VerdictDot } from "./Badges";

const AGENT_TITLE: Record<string, string> = {
  policy: "Policy Agent",
  evidence: "Evidence Agent",
  budget: "Budget Agent",
  auditor: "Auditor Agent",
};
const AGENT_ROLE: Record<string, string> = {
  policy: "Checks the funding rules",
  evidence: "Examines invoices, receipts & photos",
  budget: "Checks affordability & protected allocations",
  auditor: "Challenges the others, gates the call",
};

export function Findings({ review }: { review: AgentReview }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
        {review.findings.map((f) => (
          <div key={f.agent} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{AGENT_TITLE[f.agent]}</div>
              <VerdictDot verdict={f.verdict} />
            </div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>{AGENT_ROLE[f.agent]}</div>
            <div style={{ fontSize: 13, marginTop: 8, fontWeight: 600 }}>{f.summary}</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: "var(--muted)", fontSize: 12 }}>
              {f.details.map((d, i) => <li key={i} style={{ marginBottom: 2 }}>{d}</li>)}
            </ul>
            <div className="chip" style={{ marginTop: 8, fontSize: 10 }}>
              {f.source === "gemma" ? "Gemma" : "deterministic"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(34,211,238,0.07)", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Auditor rationale · anomaly score {review.anomalyScore}
        </div>
        <div style={{ fontSize: 14, marginTop: 4 }}>{review.rationale}</div>
      </div>
    </div>
  );
}
