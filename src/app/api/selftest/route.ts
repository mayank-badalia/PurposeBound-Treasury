import { NextResponse } from "next/server";
import { buildFixedDataset, generateDataset, CAMPAIGN_COLLECTED } from "@/lib/synthetic";
import { computePosition, assessImpact } from "@/lib/budget";
import { runReview } from "@/lib/agents";
import { analyzeEvidence } from "@/lib/evidence";
import { extractRules } from "@/lib/rules";
import { buildReport } from "@/lib/report";
import { gemmaMode } from "@/lib/gemma";
import { razorpayMode } from "@/lib/razorpay";
import type { Evidence, Expense } from "@/lib/types";

export const runtime = "nodejs";

// In-process numeric & logic test suite. Runs in offline-fallback mode, so it
// makes ZERO external LLM/API calls. Returns exact actual-vs-expected values.
export async function GET() {
  const cases: { name: string; ok: boolean; expected: unknown; actual: unknown }[] = [];
  const check = (name: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    cases.push({ name, ok, expected, actual });
  };

  // ---- 0. Mode report (informational — suite itself makes NO Gemma calls) ----
  const modeNote = `gemma=${gemmaMode()} razorpay=${razorpayMode()} (suite runs reviews with llm:false)`;
  cases.push({ name: "mode: " + modeNote, ok: true, expected: "n/a", actual: "n/a" });

  const ds = buildFixedDataset();
  const { rules, funds, expenses } = ds;
  const byScenario = (s: string) => expenses.find((e) => e.expected?.scenario === s)!;
  const clean = byScenario("Clean vendor payment");
  const venue = byScenario("Prize allocation at risk");
  const dup = byScenario("Duplicate receipt");
  const logi = byScenario("Above manual-approval limit");
  const alc = byScenario("Forbidden category");
  const mkt = byScenario("Missing invoice");

  // ---- 1. Collected total ----
  check("collected = 200000", funds.reduce((a, f) => a + f.amount, 0), CAMPAIGN_COLLECTED);

  // ---- 2. Fixed amounts are deterministic ----
  check("clean amount", clean.amount, 12200);
  check("venue amount", venue.amount, 136400);
  check("duplicate amount", dup.amount, 7000);
  check("logistics amount", logi.amount, 32500);
  check("alcohol amount", alc.amount, 5800);
  check("marketing amount", mkt.amount, 11500);

  // ---- 3. Position with nothing committed ----
  const pos0 = computePosition(funds, expenses, rules);
  check("pos0.collected", pos0.collected, 200000);
  check("pos0.transferred", pos0.transferred, 0);
  check("pos0.approvedUnpaid", pos0.approvedUnpaid, 0);
  check("pos0.reserved (prizes 40% of 200000)", pos0.reserved, 80000);
  check("pos0.cashAvailable", pos0.cashAvailable, 200000);
  check("pos0.available = 200000 - 80000", pos0.available, 120000);
  check(
    "pos0 prizes minRequired",
    pos0.categories.find((c) => c.category === "prizes")?.minRequired,
    80000,
  );
  check(
    "pos0 marketing cap",
    pos0.categories.find((c) => c.category === "marketing")?.limit,
    20000,
  );

  // ---- 4. Impact: venue breaches prize floor ----
  const impVenue = assessImpact(venue, pos0, rules);
  check("venue affordable", impVenue.affordable, true);
  check("venue within category limit", impVenue.withinCategoryLimit, true);
  check("venue breach count", impVenue.breaches.length, 1);
  check("venue breach requiredPct", impVenue.breaches[0]?.requiredPct, 40);
  check("venue breach achievablePct = round(63600/200000)", impVenue.breaches[0]?.achievablePct, 32);
  check("venue verdict", impVenue.verdict, "warn");

  // ---- 5. Impact: clean is clean ----
  const impClean = assessImpact(clean, pos0, rules);
  check("clean verdict", impClean.verdict, "pass");
  check("clean breaches", impClean.breaches.length, 0);

  // ---- 6. Spending ON the protected category does not breach it ----
  const prizeSpend = mkExpense(ds.campaign.id, { category: "prizes", amount: 50000, vendor: "Winners" });
  const impPrize = assessImpact(prizeSpend, pos0, rules);
  check("prize-spend breaches (should be 0)", impPrize.breaches.length, 0);
  check("prize-spend verdict", impPrize.verdict, "pass");

  // ---- 7. Category cap breach (marketing > 20000) ----
  const mkOver = mkExpense(ds.campaign.id, { category: "marketing", amount: 25000, vendor: "AdCo" });
  const impMk = assessImpact(mkOver, pos0, rules);
  check("marketing over cap: withinCategoryLimit", impMk.withinCategoryLimit, false);
  check("marketing over cap: verdict", impMk.verdict, "fail");

  // ---- 8. Unaffordable ----
  const huge = mkExpense(ds.campaign.id, { category: "misc", amount: 250000, vendor: "Big" });
  const impHuge = assessImpact(huge, pos0, rules);
  check("unaffordable: affordable=false", impHuge.affordable, false);
  check("unaffordable: verdict", impHuge.verdict, "fail");

  // ---- 9. Full pipeline on all 6 (verification + recommendation + amounts) ----
  const rv = async (e: Expense) => runReview({ expense: e, rules, funds, campaignExpenses: expenses }, { llm: false });
  const rClean = await rv(clean);
  check("review clean verification", rClean.verification, "verified");
  check("review clean recommendation", rClean.recommendation, "approve_full");
  check("review clean approvedAmount", rClean.approvedAmount, 12200);
  check("review clean anomaly", rClean.anomalyScore, 0.1);

  const rVenue = await rv(venue);
  check("review venue verification", rVenue.verification, "verified");
  check("review venue recommendation", rVenue.recommendation, "approve_partial");
  check("review venue approvedAmount = available 120000", rVenue.approvedAmount, 120000);
  check("review venue anomaly", rVenue.anomalyScore, 0.4);

  const rDup = await rv(dup);
  check("review dup verification", rDup.verification, "suspicious");
  check("review dup recommendation", rDup.recommendation, "reject");
  check("review dup approvedAmount", rDup.approvedAmount, 0);

  const rLogi = await rv(logi);
  check("review logistics verification", rLogi.verification, "verified");
  check("review logistics recommendation", rLogi.recommendation, "hold");
  check("review logistics approvedAmount (hold keeps full)", rLogi.approvedAmount, 32500);
  check("review logistics anomaly", rLogi.anomalyScore, 0.1);

  const rAlc = await rv(alc);
  check("review alcohol verification", rAlc.verification, "not_permitted");
  check("review alcohol recommendation", rAlc.recommendation, "reject");

  const rMkt = await rv(mkt);
  check("review marketing verification", rMkt.verification, "missing_evidence");
  check("review marketing recommendation", rMkt.recommendation, "request_evidence");

  // ---- 10. Precise position after a transfer + a partial approval ----
  const exps2 = structuredClone(expenses) as Expense[];
  const c2 = exps2.find((e) => e.id === clean.id)!;
  const v2 = exps2.find((e) => e.id === venue.id)!;
  c2.status = "transferred";
  v2.status = "partially_approved";
  v2.humanDecision = { decision: "approve", approvedAmount: 120000, decidedBy: "t", note: "", decidedAt: "" };
  const pos2 = computePosition(funds, exps2, rules);
  check("pos2.transferred = 12200", pos2.transferred, 12200);
  check("pos2.approvedUnpaid = 120000", pos2.approvedUnpaid, 120000);
  check("pos2.reserved = 80000", pos2.reserved, 80000);
  check("pos2.cashAvailable = 200000-12200-120000", pos2.cashAvailable, 67800);
  check("pos2.available = 67800-80000", pos2.available, -12200);

  // ---- 10b. REGRESSION: "spent" = actual transfer, never the recommendation ----
  // (A human can override the agent's suggested partial; the money that moved is
  //  the truth. This guards the ₹ drift bug found in integration testing.)
  const reg: Expense = {
    ...mkExpense(ds.campaign.id, { category: "venue", amount: 136400, vendor: "GrandHall" }),
    status: "transferred",
    transfer: { id: "t", expenseId: "x", amount: 120000, razorpayTransferId: "trf", linkedAccountId: "a", status: "processed", demo: true, createdAt: "" },
    review: { verification: "verified", findings: [], recommendation: "approve_partial", approvedAmount: 107800, rationale: "", anomalyScore: 0, reviewedAt: "" },
    humanDecision: { decision: "approve", approvedAmount: 120000, decidedBy: "", note: "", decidedAt: "" },
  };
  const posReg = computePosition(funds, [reg], rules);
  check("spent counts the ACTUAL transfer (120000), not the recommendation (107800)", posReg.transferred, 120000);

  // ---- 11. Report figures reconcile (spent + committed + remaining = collected) ----
  const report = await buildReport(ds.campaign, rules, funds, exps2, [], { llm: false });
  check("report.spent", report.spent, 12200);
  check("report.committed", report.committed, 120000);
  check("report.remaining", report.remaining, 67800);
  check("report identity: spent+committed+remaining = collected",
    report.spent + report.committed + report.remaining, report.collected);
  check("report prizes compliance at_risk",
    report.compliance.find((c) => c.rule.includes("prizes"))?.status, "at_risk");
  check("report marketing compliance met",
    report.compliance.find((c) => c.rule.includes("Marketing"))?.status, "met");

  // ---- 12. Duplicate detection is order-aware ----
  const aDupLater = analyzeEvidence(dup, rules, clean.evidence);
  check("dup (later) flagged suspicious", aDupLater.verification, "suspicious");
  check("dup has >=1 duplicate hit", aDupLater.duplicates.length >= 1, true);
  check("dup hit is exact", aDupLater.duplicates[0]?.kind, "exact");
  const aCleanEarlier = analyzeEvidence(clean, rules, dup.evidence);
  check("clean (earlier) NOT flagged by its later copy", aCleanEarlier.verification, "verified");
  check("clean earlier has 0 duplicate hits", aCleanEarlier.duplicates.length, 0);

  // ---- 13. Missing invoice ----
  const aMkt = analyzeEvidence(mkt, rules, []);
  check("missing invoice -> missing_evidence", aMkt.verification, "missing_evidence");
  check("missing invoice hasRequiredInvoice=false", aMkt.hasRequiredInvoice, false);

  // ---- 14. Generator determinism & size ----
  const g1 = generateDataset({ seed: "determinism", size: 8 });
  const g2 = generateDataset({ seed: "determinism", size: 8 });
  const g3 = generateDataset({ seed: "different", size: 8 });
  check("generator fully reproducible (ids included)", JSON.stringify(g1), JSON.stringify(g2));
  check("different seed -> different data", JSON.stringify(g1) !== JSON.stringify(g3), true);
  check("generator respects size", g1.expenses.length, 8);
  const big = generateDataset({ seed: "perf", size: 150 });
  check("large generate size", big.expenses.length, 150);
  check("every generated expense amount > 0", big.expenses.every((e) => e.amount > 0), true);
  check("every generated expense has expected", big.expenses.every((e) => !!e.expected), true);

  // ---- 15. Fallback rule extraction (tests the forbidden-order fix) ----
  const SAMPLE = `At least 40% of funds must be used for prizes. Marketing expenses cannot exceed ₹20,000. All vendor payments require a valid invoice. Expenses above ₹25,000 require manual approval. Alcohol is not a permitted expense. Unused funds must be refunded.`;
  const { rules: ex, source } = await extractRules("camp_x", SAMPLE, { llm: false });
  const kinds = new Set(ex.map((r) => r.kind));
  check("extract source is fallback", source, "fallback");
  check("extract: min_category_pct", kinds.has("min_category_pct"), true);
  check("extract: max_category_amount", kinds.has("max_category_amount"), true);
  check("extract: requires_invoice", kinds.has("requires_invoice"), true);
  check("extract: manual_approval_above", kinds.has("manual_approval_above"), true);
  check("extract: refund_unused", kinds.has("refund_unused"), true);
  check("extract: forbidden alcohol (word-order fix)",
    ex.some((r) => r.kind === "forbidden_category" && r.category === "alcohol"), true);
  check("extract: prize pct = 40",
    ex.find((r) => r.kind === "min_category_pct")?.pct, 40);
  check("extract: marketing cap = 20000",
    ex.find((r) => r.kind === "max_category_amount")?.amount, 20000);
  check("extract: manual threshold = 25000",
    ex.find((r) => r.kind === "manual_approval_above")?.amount, 25000);

  // ---- 16. Manual-approval threshold boundary (25000 vs 25001) ----
  const atThreshold = withInvoice(mkExpense(ds.campaign.id, { category: "catering", amount: 25000, vendor: "Edge" }));
  const overThreshold = withInvoice(mkExpense(ds.campaign.id, { category: "catering", amount: 25001, vendor: "Edge" }));
  const rAt = await runReview({ expense: atThreshold, rules, funds, campaignExpenses: [atThreshold] }, { llm: false });
  const rOver = await runReview({ expense: overThreshold, rules, funds, campaignExpenses: [overThreshold] }, { llm: false });
  check("amount == threshold (25000) -> approve_full", rAt.recommendation, "approve_full");
  check("amount == threshold verification", rAt.verification, "verified");
  check("amount > threshold (25001) -> hold", rOver.recommendation, "hold");

  // ---- 17. Empty inputs don't crash ----
  const posEmpty = computePosition([], [], []);
  check("empty position collected", posEmpty.collected, 0);
  check("empty position available", posEmpty.available, 0);

  const passed = cases.filter((c) => c.ok).length;
  const failed = cases.length - passed;
  return NextResponse.json({
    ok: failed === 0,
    total: cases.length,
    passed,
    failed,
    apiCalls: { llm: 0, note: "offline fallback mode — no external LLM/Razorpay calls made" },
    failures: cases.filter((c) => !c.ok),
    cases,
  });
}

// ---- tiny factories for crafted edge cases ----
function mkExpense(campaignId: string, over: Partial<Expense>): Expense {
  return {
    id: "exp_test_" + Math.random().toString(16).slice(2, 10),
    campaignId,
    category: "general",
    amount: 0,
    vendor: "V",
    description: "test",
    status: "submitted",
    createdAt: new Date().toISOString(),
    evidence: [],
    synthetic: true,
    ...over,
    recipient: over.recipient ?? over.vendor ?? "V",
  };
}

function withInvoice(e: Expense): Expense {
  const ev: Evidence = {
    id: "ev_test_" + Math.random().toString(16).slice(2, 10),
    expenseId: e.id,
    type: "invoice",
    filename: "invoice.pdf",
    mimeType: "application/pdf",
    size: 100,
    contentHash: "h" + Math.random().toString(16).slice(2),
    visualFingerprint: "f".repeat(64),
    uploadedAt: new Date().toISOString(),
    extracted: { vendor: e.vendor, amount: e.amount, supportsClaim: true },
  };
  return { ...e, evidence: [ev] };
}
