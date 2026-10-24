import { allExpenses, listCampaigns } from "@/lib/store";
import { inr } from "@/lib/format";
import { ReviewButton, DecisionButtons } from "@/components/Actions";
import { Findings } from "@/components/Findings";
import { RecommendationBadge, StatusBadge, VerificationBadge } from "@/components/Badges";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

function ExpenseCard({ e, campaignName }: { e: Expense; campaignName: string }) {
  const needsReview = e.status === "submitted" || e.status === "under_review";
  const awaiting = e.status === "awaiting_human";
  const suggestPartial =
    e.review?.recommendation === "approve_partial" ? e.review.approvedAmount : undefined;

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {e.vendor} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>· {e.category}</span>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{e.description}</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{campaignName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{inr(e.amount)}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4, flexWrap: "wrap" }}>
            <VerificationBadge v={e.review?.verification} />
            <RecommendationBadge r={e.review?.recommendation} />
            <StatusBadge s={e.status} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {e.evidence.map((ev) => (
          <span key={ev.id} className="chip" title={`sha256 ${ev.contentHash.slice(0, 24)}…`}>
            {ev.type}: {ev.filename}
          </span>
        ))}
        {e.evidence.length === 0 && <span className="chip" style={{ color: "var(--warn)" }}>no evidence</span>}
      </div>

      {e.review && <div style={{ marginTop: 14 }}><Findings review={e.review} /></div>}

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {needsReview && <ReviewButton expenseId={e.id} />}
        {awaiting && (
          <>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Recommendation: <strong>{e.review?.recommendation?.replace(/_/g, " ")}</strong>. A human must confirm.
            </span>
            <DecisionButtons expenseId={e.id} defaultAmount={e.amount} suggestPartial={suggestPartial} />
          </>
        )}
        {e.transfer && (
          <span
            className="chip mono"
            style={{ color: e.transfer.demo ? "var(--warn)" : "var(--ok)", borderColor: e.transfer.demo ? "var(--warn)" : "var(--border)" }}
            title={e.transfer.demo ? "Simulated — Razorpay Route not yet enabled" : "Live Razorpay Route transfer"}
          >
            {e.transfer.demo ? "Demo Transfer" : "Route transfer"} · {e.transfer.razorpayTransferId} · {inr(e.transfer.amount)}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function ApprovalsPage() {
  const [expenses, campaigns] = await Promise.all([allExpenses(), listCampaigns()]);
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  const order = (e: Expense) =>
    e.status === "awaiting_human" ? 0 : e.status === "submitted" || e.status === "under_review" ? 1 : 2;
  const sorted = [...expenses].sort((a, b) => order(a) - order(b) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Multi-Agent Approvals</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 6, marginBottom: 18 }}>
        Four agents — Policy, Evidence, Budget and Auditor — review each expense. The Auditor only recommends;
        an authorised human confirms before any Razorpay transfer occurs.
      </p>
      {sorted.length === 0 && (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
          No expenses yet. Load the demo dataset from the Synthetic Data tab.
        </div>
      )}
      <div style={{ display: "grid", gap: 14 }}>
        {sorted.map((e) => (
          <ExpenseCard key={e.id} e={e} campaignName={names.get(e.campaignId) ?? ""} />
        ))}
      </div>
    </div>
  );
}
