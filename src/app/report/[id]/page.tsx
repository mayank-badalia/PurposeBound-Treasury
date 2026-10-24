import Link from "next/link";
import { campaignReport } from "@/lib/service";
import { inr } from "@/lib/format";
import { VerificationBadge, StatusBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let report;
  try {
    report = await campaignReport(id);
  } catch {
    return (
      <div className="card" style={{ padding: 30, textAlign: "center" }}>
        <p>Campaign not found.</p>
        <Link className="btn" href="/">← Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: "34px 36px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #fffdfb 0%, #fdeef1 100%)" }}>
        <div className="ribbon" style={{ width: 420, height: 260, right: -100, top: -60 }} />
        <div style={{ position: "relative" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Transparency · {report.campaign.name}</div>
          <h1 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 52px)" }}>A promise, accounted for.</h1>
          <p style={{ fontSize: 16, marginTop: 14, lineHeight: 1.6, maxWidth: 720, color: "var(--body)" }}>{report.narrative}</p>
          <div className="chip" style={{ marginTop: 14, fontSize: 11 }}>
            narrative: {report.narrativeSource === "gemma" ? "Gemma" : "deterministic"}
          </div>
        </div>
      </div>

      <div className="reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
        {[
          ["Collected", inr(report.collected), "var(--text)"],
          ["Transferred", inr(report.spent), "var(--brand)"],
          ["Approved · unpaid", inr(report.committed), "var(--brand-2)"],
          ["Remaining", inr(report.remaining), "var(--warn)"],
        ].map(([l, v, c]) => (
          <div key={l} className="card" style={{ padding: "18px 20px" }}>
            <div className="label" style={{ margin: 0 }}>{l}</div>
            <div className="serif" style={{ fontSize: 30, fontWeight: 600, color: c, marginTop: 6, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Compliance with the declared purpose */}
      <div className="card reveal" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Compliance with the original purpose</div>
        <div style={{ display: "grid", gap: 8 }}>
          {report.compliance.map((c, i) => {
            const color = c.status === "met" ? "var(--ok)" : c.status === "at_risk" ? "var(--warn)" : "var(--muted)";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span>{c.rule}</span>
                <span style={{ color, fontWeight: 700 }}>{c.status.replace(/_/g, " ")}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category utilisation */}
      <div className="card reveal" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Category-wise utilisation</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10 }}>
          {report.categories.map((c) => (
            <div key={c.category} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{c.category}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Committed {inr(c.committed)}</div>
              {c.minRequired != null && <div style={{ fontSize: 12, color: c.status === "below_min" ? "var(--warn)" : "var(--muted)" }}>Min {c.minPct}% = {inr(c.minRequired)}</div>}
              {c.limit != null && <div style={{ fontSize: 12, color: c.status === "over_cap" ? "var(--danger)" : "var(--muted)" }}>Cap {inr(c.limit)}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Expenses */}
      <div className="card reveal" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Expenses</div>
        <div style={{ display: "grid", gap: 8 }}>
          {report.expenses.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, flexWrap: "wrap" }}>
              <div><strong>{e.vendor}</strong> <span style={{ color: "var(--muted)" }}>· {e.category}</span></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{inr(e.amount)}</span>
                <VerificationBadge v={e.verification} />
                <StatusBadge s={e.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hash anchors — tamper-evident chain of custody */}
      <div className="card reveal" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Tamper-proof hash anchors</div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Only hashes are anchored — the private documents stay in Google Drive. {report.anchors[0]?.onChain ? "Anchored on-chain." : "Chain anchoring simulated (no chain configured)."}
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {report.anchors.slice(-18).map((a) => (
            <div key={a.id} className="mono" style={{ fontSize: 11, display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" }}>
              <span className="chip" style={{ fontSize: 10 }}>{a.kind}</span>
              <span style={{ color: "var(--muted)" }}>sha256 {a.sha256.slice(0, 32)}…</span>
              <span style={{ color: "var(--brand-2)" }}>{a.txRef.slice(0, 18)}…</span>
            </div>
          ))}
        </div>
      </div>

      <Link className="btn" href="/">← Back to dashboard</Link>
    </div>
  );
}
