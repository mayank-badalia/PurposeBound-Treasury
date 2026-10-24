import Link from "next/link";
import { listCampaigns, rulesFor, fundsFor, expensesFor, anchorsFor } from "@/lib/store";
import { computePosition } from "@/lib/budget";
import { buildReconciliation } from "@/lib/reconcile";
import { inr } from "@/lib/format";
import { SeedDemoButton } from "@/components/Actions";
import SponsorPayment from "@/components/SponsorPayment";
import { StatusBadge, VerificationBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="label" style={{ margin: 0 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "var(--text)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const campaigns = await listCampaigns();

  if (campaigns.length === 0) {
    return (
      <div>
        <Hero />
        <div className="card" style={{ padding: 40, textAlign: "center", marginTop: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>No campaigns yet</h2>
          <p style={{ color: "var(--muted)", margin: "8px 0 18px" }}>
            Load the fixed synthetic demo (a sponsored hackathon with 6 pre-built expense scenarios)
            to see the full verified chain in action.
          </p>
          <SeedDemoButton />
        </div>
      </div>
    );
  }

  // Primary campaign = the most recent.
  const campaign = campaigns[campaigns.length - 1];
  const [rules, funds, expenses, anchors] = await Promise.all([
    rulesFor(campaign.id),
    fundsFor(campaign.id),
    expensesFor(campaign.id),
    anchorsFor(campaign.id),
  ]);
  const pos = computePosition(funds, expenses, rules);
  const awaiting = expenses.filter((e) => e.status === "awaiting_human").length;
  const recon = await buildReconciliation(campaign.id);

  return (
    <div>
      <Hero />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 12px", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{campaign.name}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {campaign.organiser} · {rules.length} rules locked · {anchors.length} hash anchors
            {campaign.synthetic && <span className="chip" style={{ marginLeft: 8 }}>SYNTHETIC</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <SponsorPayment campaignId={campaign.id} />
          <Link className="btn" href="/approvals">Approvals{awaiting ? ` (${awaiting})` : ""}</Link>
          <Link className="btn" href={`/report/${campaign.id}`}>Transparency report</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <Stat label="Collected" value={inr(pos.collected)} sub="via Razorpay" />
        <Stat label="Transferred" value={inr(pos.transferred)} accent="var(--brand)" sub="to verified vendors" />
        <Stat label="Approved · unpaid" value={inr(pos.approvedUnpaid)} />
        <Stat label="Reserved (protected)" value={inr(pos.reserved)} accent="var(--warn)" sub="min allocations" />
        <Stat label="Available" value={inr(pos.available)} accent="var(--brand-2)" sub="spendable now" />
      </div>

      {/* Category protection */}
      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Protected allocations &amp; caps</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {pos.categories.length === 0 && <div style={{ color: "var(--muted)" }}>No category commitments yet.</div>}
          {pos.categories.map((c) => {
            const over = c.limit != null && c.committed > c.limit;
            const below = c.minRequired != null && c.committed < c.minRequired;
            return (
              <div key={c.category} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{c.category}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Committed {inr(c.committed)}</div>
                {c.minRequired != null && (
                  <div style={{ fontSize: 12, color: below ? "var(--warn)" : "var(--muted)" }}>
                    Min {c.minPct}% = {inr(c.minRequired)} {below ? "· under-funded" : "· on track"}
                  </div>
                )}
                {c.limit != null && (
                  <div style={{ fontSize: 12, color: over ? "var(--danger)" : "var(--muted)" }}>
                    Cap {inr(c.limit)} {over ? "· breached" : "· within cap"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Money chain — reconciliation (incoming sponsor payments <-> outgoing transfers) */}
      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Money chain · verified reconciliation</div>
          <span className="chip" style={{ color: recon.reconciled ? "var(--ok)" : "var(--danger)", borderColor: recon.reconciled ? "var(--ok)" : "var(--danger)" }}>
            {recon.reconciled ? "reconciled" : "over-transferred"} · in {inr(recon.totalReceived)} / out {inr(recon.totalTransferred)}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div className="label" style={{ margin: "0 0 8px" }}>Incoming — sponsor payments</div>
            {recon.incoming.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No sponsor payments yet. Use “Request sponsor payment”.</div>}
            {recon.incoming.map((p) => (
              <div key={p.fundId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{p.sponsor}</strong><span style={{ fontWeight: 800, color: "var(--brand)" }}>{inr(p.amount)}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.razorpayOrderId} · {p.razorpayPaymentId} · {p.status}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="label" style={{ margin: "0 0 8px" }}>Outgoing — vendor transfers</div>
            {recon.outgoing.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No transfers yet.</div>}
            {recon.outgoing.map((t) => (
              <div key={t.expenseId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{t.vendor}</strong>
                  <span style={{ fontWeight: 800, color: t.demo ? "var(--warn)" : "var(--ok)" }}>{inr(t.approvedAmount)}{t.demo ? " · Demo" : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.chain}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {t.razorpayTransferId} → {t.vendorLinkedAccountId}{t.invoiceHash ? ` · inv ${t.invoiceHash.slice(0, 10)}…` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent expenses */}
      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Expenses</div>
          <Link className="btn" href="/expenses/new" style={{ padding: "6px 12px" }}>+ Submit expense</Link>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {expenses.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>
                  {e.vendor} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {e.category}</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{e.description}</div>
              </div>
              <div style={{ fontWeight: 800 }}>{inr(e.amount)}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <VerificationBadge v={e.review?.verification} />
                <StatusBadge s={e.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="card" style={{ padding: 26, background: "linear-gradient(120deg, rgba(52,211,153,0.10), rgba(34,211,238,0.06))" }}>
      <div className="chip" style={{ marginBottom: 10 }}>Track 2 · Gemma · AI fund-control</div>
      <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>
        Every rupee connected to its promised purpose.
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 8, maxWidth: 720 }}>
        PurposeBound Treasury turns funding promises into enforceable spending rules, verifies invoices
        and photo evidence with Gemma, guards the live budget, and releases Razorpay transfers only when an
        expense matches its declared purpose — with every step hash-anchored.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", color: "var(--muted)", fontSize: 13 }}>
        <span className="chip">Purpose → Rule → Evidence → AI review → Human → Transfer → Report</span>
      </div>
    </div>
  );
}
