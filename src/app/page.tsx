import Link from "next/link";
import { listCampaigns, rulesFor, fundsFor, expensesFor, anchorsFor } from "@/lib/store";
import { computePosition } from "@/lib/budget";
import { buildReconciliation } from "@/lib/reconcile";
import { inr } from "@/lib/format";
import { SeedDemoButton } from "@/components/Actions";
import SponsorPayment from "@/components/SponsorPayment";
import CountUp from "@/components/CountUp";
import { StatusBadge, VerificationBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div className="label" style={{ margin: 0 }}>{label}</div>
      <div className="serif" style={{ fontSize: 32, fontWeight: 600, color: accent ?? "var(--text)", marginTop: 6, lineHeight: 1 }}>
        <CountUp value={value} />
      </div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const campaigns = await listCampaigns();

  if (campaigns.length === 0) {
    return (
      <div>
        <Hero />
        <div className="card" style={{ padding: 48, textAlign: "center", marginTop: 20 }}>
          <h2 className="display" style={{ fontSize: 26 }}>No campaigns yet</h2>
          <p style={{ color: "var(--muted)", margin: "10px auto 20px", maxWidth: 440 }}>
            Load the fixed synthetic demo — a sponsored hackathon with six pre-built expense scenarios — to
            see the full verified chain in action.
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

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "34px 0 16px", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Treasury in action</div>
          <h2 className="display" style={{ fontSize: 34 }}>
            {campaign.name}
            {campaign.synthetic && <span className="chip" style={{ marginLeft: 12, verticalAlign: "middle", fontSize: 11 }}>synthetic</span>}
          </h2>
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6 }}>
            {campaign.organiser} · {rules.length} rules locked · {anchors.length} hash anchors
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <SponsorPayment campaignId={campaign.id} />
          <Link className="btn" href="/approvals">Approvals{awaiting ? ` · ${awaiting}` : ""}</Link>
          <Link className="btn" href={`/report/${campaign.id}`}>Transparency report</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))", gap: 12 }}>
        <Stat label="Collected" value={pos.collected} sub="via Razorpay" />
        <Stat label="Transferred" value={pos.transferred} accent="var(--brand)" sub="to verified vendors" />
        <Stat label="Approved · unpaid" value={pos.approvedUnpaid} />
        <Stat label="Reserved · protected" value={pos.reserved} accent="var(--warn)" sub="min allocations" />
        <Stat label="Available" value={pos.available} accent="var(--brand-2)" sub="spendable now" />
      </div>

      {/* Category protection */}
      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <SectionHead eyebrow="Guardrails" title="Protected allocations & caps" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 14 }}>
          {pos.categories.length === 0 && <div style={{ color: "var(--muted)" }}>No category commitments yet.</div>}
          {pos.categories.map((c) => {
            const over = c.limit != null && c.committed > c.limit;
            const below = c.minRequired != null && c.committed < c.minRequired;
            const ceiling = c.minRequired ?? c.limit ?? Math.max(c.committed, 1);
            const pct = Math.max(2, Math.min(100, Math.round((c.committed / (ceiling || 1)) * 100)));
            return (
              <div key={c.category} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--panel-2)" }}>
                <div className="serif" style={{ fontSize: 17, textTransform: "capitalize" }}>{c.category}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 10px" }}>Committed {inr(c.committed)}</div>
                <div className="meter"><span style={{ width: `${pct}%`, background: over ? "var(--danger)" : below ? "var(--warn)" : "var(--brand)" }} /></div>
                {c.minRequired != null && (
                  <div style={{ fontSize: 12, marginTop: 8, color: below ? "var(--warn)" : "var(--muted)" }}>
                    Minimum {c.minPct}% = {inr(c.minRequired)} {below ? "· under-funded" : "· on track"}
                  </div>
                )}
                {c.limit != null && (
                  <div style={{ fontSize: 12, marginTop: 6, color: over ? "var(--danger)" : "var(--muted)" }}>
                    Cap {inr(c.limit)} {over ? "· breached" : "· within cap"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Money chain — reconciliation */}
      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
          <SectionHead eyebrow="Transparency" title="Money chain · verified reconciliation" />
          <span className="chip" style={{ color: recon.reconciled ? "var(--ok)" : "var(--danger)", borderColor: recon.reconciled ? "var(--ok)" : "var(--danger)" }}>
            {recon.reconciled ? "reconciled" : "over-transferred"} · in {inr(recon.totalReceived)} / out {inr(recon.totalTransferred)}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <div className="label" style={{ margin: "0 0 10px" }}>Incoming — sponsor payments</div>
            {recon.incoming.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No sponsor payments yet. Use “Request sponsor payment”.</div>}
            {recon.incoming.map((p) => (
              <div key={p.fundId} style={{ borderLeft: "2px solid var(--ok)", padding: "4px 0 4px 12px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ color: "var(--text)" }}>{p.sponsor}</strong>
                  <span className="serif" style={{ fontSize: 17, color: "var(--ok)" }}>{inr(p.amount)}</span>
                </div>
                <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>{p.razorpayOrderId} · {p.razorpayPaymentId} · {p.status}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="label" style={{ margin: "0 0 10px" }}>Outgoing — vendor transfers</div>
            {recon.outgoing.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No transfers yet.</div>}
            {recon.outgoing.map((t) => (
              <div key={t.expenseId} style={{ borderLeft: `2px solid ${t.demo ? "var(--warn)" : "var(--brand)"}`, padding: "4px 0 4px 12px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ color: "var(--text)" }}>{t.vendor}</strong>
                  <span className="serif" style={{ fontSize: 17, color: t.demo ? "var(--warn)" : "var(--brand)" }}>{inr(t.approvedAmount)}{t.demo ? " · Demo" : ""}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{t.chain}</div>
                <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                  {t.razorpayOrderId ?? t.razorpayTransferId} → {t.vendorLinkedAccountId}{t.invoiceHash ? ` · inv ${t.invoiceHash.slice(0, 10)}…` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Expenses */}
      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <SectionHead eyebrow="Requests" title="Expenses" />
          <Link className="btn" href="/expenses/new" style={{ padding: "7px 14px" }}>+ Submit expense</Link>
        </div>
        <div style={{ marginTop: 14 }}>
          {expenses.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "14px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)", flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>
                  {e.vendor} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {e.category}</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>{e.description}</div>
              </div>
              <div className="serif" style={{ fontSize: 19, color: "var(--text)" }}>{inr(e.amount)}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <VerificationBadge v={e.review?.verification} />
                <StatusBadge s={e.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
      <h3 className="display" style={{ fontSize: 22 }}>{title}</h3>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="card reveal reveal-1 in"
      style={{ padding: "40px 40px 44px", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #fffdfb 0%, #fdeef1 100%)" }}
    >
      <div className="ribbon" style={{ width: 520, height: 320, right: -120, top: -80 }} />
      <div style={{ position: "relative", maxWidth: 820 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>From agreements to action</div>
        <h1 className="rise display" style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.04 }}>
          <span>Every rupee. Every promise.</span>
        </h1>
        <p style={{ color: "var(--body)", marginTop: 16, maxWidth: 640, fontSize: 16.5, lineHeight: 1.6 }}>
          Turn funding promises into enforceable spending rules. Gemma reads every invoice and photo,
          the budget stays guarded, and a Razorpay transfer releases only when an expense matches its
          declared purpose — with every step hash-anchored.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <span className="chip" style={{ background: "rgba(255,255,255,0.7)" }}>
            Purpose → Rule → Evidence → AI review → Human → Transfer → Report
          </span>
        </div>
      </div>
    </section>
  );
}
