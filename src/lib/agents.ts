// Feature 4: Multi-Agent Spending Approval.
//
// Four focused agents review every expense, coordinated as a typed state graph
// (a minimal in-house LangGraph-style runner — nodes read and write one shared
// ExpenseCase, with the Auditor gating the final recommendation). Implemented
// without an external orchestration dependency so it always runs; the shape is
// drop-in replaceable with @langchain/langgraph.
//
//   Policy  -> Evidence -> Budget -> Auditor -> (human gate)
//
// Separation of duties is enforced: the Evidence agent cannot approve payment,
// the Budget agent cannot judge authenticity, and the Auditor challenges both.

import { analyzeEvidence } from "./evidence";
import { assessImpact, computePosition } from "./budget";
import { scoreAnomaly } from "./anomaly";
import { callGemma, withGemma } from "./gemma";
import type {
  AgentFinding,
  AgentReview,
  Evidence,
  Expense,
  Fund,
  Recommendation,
  Rule,
  VerificationResult,
} from "./types";

export interface ReviewInputs {
  expense: Expense;
  rules: Rule[];
  funds: Fund[];
  campaignExpenses: Expense[]; // all expenses (for budget position + dup detection)
}

// ---- shared graph state ----
interface CaseState {
  inputs: ReviewInputs;
  findings: AgentFinding[];
  verification: VerificationResult;
  anomalyScore: number;
  recommendation: Recommendation;
  approvedAmount: number;
}

// ---------- Node 1: Policy Agent ----------
function policyNode(s: CaseState) {
  const { expense, rules } = s.inputs;
  const details: string[] = [];
  let verdict: AgentFinding["verdict"] = "pass";

  const forbidden = rules.find(
    (r) => r.kind === "forbidden_category" && r.category === expense.category,
  );
  if (forbidden) {
    verdict = "fail";
    details.push(`Category "${expense.category}" is explicitly not permitted (${forbidden.label}).`);
    s.verification = "not_permitted";
  }

  const manual = rules.find((r) => r.kind === "manual_approval_above");
  if (manual?.amount != null && expense.amount > manual.amount) {
    if (verdict !== "fail") verdict = "warn";
    details.push(
      `Amount ₹${expense.amount.toLocaleString("en-IN")} exceeds the ₹${manual.amount.toLocaleString("en-IN")} manual-approval threshold.`,
    );
  }

  if (rules.some((r) => r.kind === "requires_invoice")) {
    details.push("Funding rules require an invoice for vendor payments.");
  }
  if (details.length === 0) details.push("Expense category and amount are within the funding rules.");

  s.findings.push({
    agent: "policy",
    verdict,
    summary:
      verdict === "fail"
        ? "Expense is not permitted by the funding rules."
        : verdict === "warn"
          ? "Permitted, but requires manual approval."
          : "Complies with the funding rules.",
    details,
    source: "deterministic",
  });
}

// ---------- Node 2: Evidence Agent ----------
function evidenceNode(s: CaseState) {
  const { expense, rules, campaignExpenses } = s.inputs;
  const priorEvidence: Evidence[] = campaignExpenses
    .filter((e) => e.id !== expense.id)
    .flatMap((e) => e.evidence);

  const a = analyzeEvidence(expense, rules, priorEvidence);
  // Evidence agent only sets verification if policy did not already veto it.
  if (s.verification !== "not_permitted") s.verification = a.verification;

  const verdict: AgentFinding["verdict"] =
    a.verification === "verified" ? "pass" : a.verification === "missing_evidence" ? "fail" : "warn";

  s.findings.push({
    agent: "evidence",
    verdict,
    summary:
      a.verification === "verified"
        ? "Evidence verified against the claim."
        : a.verification === "missing_evidence"
          ? "Required evidence is missing."
          : "Evidence is suspicious.",
    details: a.details,
    source: "deterministic",
  });
}

// ---------- Node 3: Budget Agent ----------
function budgetNode(s: CaseState) {
  const { expense, rules, funds, campaignExpenses } = s.inputs;
  const position = computePosition(funds, campaignExpenses, rules);
  const impact = assessImpact(expense, position, rules);

  // Suggest a partial amount when a protected minimum is at risk.
  if (impact.verdict === "warn" && position.available > 0) {
    s.approvedAmount = Math.min(expense.amount, position.available);
  }

  s.findings.push({
    agent: "budget",
    verdict: impact.verdict,
    summary: impact.summary,
    details: impact.details,
    source: "deterministic",
  });

  const median = medianAmount(campaignExpenses);
  const vendorSeen = campaignExpenses.some(
    (e) => e.id !== expense.id && e.vendor.toLowerCase() === expense.vendor.toLowerCase(),
  );
  s.anomalyScore = scoreAnomaly(expense, rules, {
    medianAmount: median,
    vendorSeenBefore: vendorSeen,
  }).score;
}

// ---------- Node 4: Auditor Agent (gate) ----------
function auditorNode(s: CaseState) {
  const policy = s.findings.find((f) => f.agent === "policy")!;
  const budget = s.findings.find((f) => f.agent === "budget")!;
  const details: string[] = [];
  let verdict: AgentFinding["verdict"] = "pass";
  let rec: Recommendation = "approve_full";

  if (policy.verdict === "fail") {
    rec = "reject";
    verdict = "fail";
    details.push("Policy veto: the expense is outside the declared purpose.");
  } else if (s.verification === "missing_evidence") {
    rec = "request_evidence";
    verdict = "warn";
    details.push("Cannot verify the spend until the missing evidence is supplied.");
  } else if (s.verification === "suspicious") {
    // Duplicates / amount mismatches are hard stops; a weak photo is a hold.
    rec = "reject";
    verdict = "fail";
    details.push("Evidence integrity failed — contradictions between the claim and the proof.");
  } else if (budget.verdict === "fail") {
    rec = "reject";
    verdict = "fail";
    details.push(`Budget cannot support the expense — ${budget.summary}`);
  } else if (budget.verdict === "warn") {
    rec = s.approvedAmount > 0 ? "approve_partial" : "hold";
    verdict = "warn";
    details.push(
      s.approvedAmount > 0
        ? `Recommend a partial ₹${s.approvedAmount.toLocaleString("en-IN")} to protect reserved allocations.`
        : "Hold until reserved allocations are rebalanced.",
    );
  } else if (policy.verdict === "warn") {
    rec = "hold";
    verdict = "warn";
    details.push("Clean on evidence and budget, but above the manual-approval threshold — routed to a human.");
  } else {
    rec = "approve_full";
    details.push("All agents agree: purpose, proof and budget check out.");
  }

  if (s.anomalyScore >= 0.6 && rec === "approve_full") {
    rec = "hold";
    verdict = "warn";
    details.push(`Anomaly score ${s.anomalyScore} is elevated — flagged for a human look.`);
  }

  s.recommendation = rec;
  if (rec !== "approve_partial") s.approvedAmount = rec === "reject" ? 0 : s.inputs.expense.amount;

  s.findings.push({
    agent: "auditor",
    verdict,
    summary: recLabel(rec),
    details,
    source: "deterministic",
  });
}

function medianAmount(expenses: Expense[]): number {
  const amts = expenses.map((e) => e.amount).sort((a, b) => a - b);
  if (!amts.length) return 0;
  const mid = Math.floor(amts.length / 2);
  return amts.length % 2 ? amts[mid] : (amts[mid - 1] + amts[mid]) / 2;
}

export function recLabel(r: Recommendation): string {
  return {
    approve_full: "Approve fully",
    approve_partial: "Approve partially",
    request_evidence: "Request evidence",
    hold: "Hold",
    reject: "Reject",
  }[r];
}

// Run the full graph and build the AgentReview.
export async function runReview(inputs: ReviewInputs): Promise<AgentReview> {
  const s: CaseState = {
    inputs,
    findings: [],
    verification: "verified",
    anomalyScore: 0,
    recommendation: "approve_full",
    approvedAmount: inputs.expense.amount,
  };

  policyNode(s);
  evidenceNode(s);
  budgetNode(s);
  auditorNode(s);

  // Auditor rationale: Gemma writes the human-readable summary if available,
  // else a deterministic synthesis of the findings.
  const { value: rationale, source } = await withGemma<string>(
    async () => {
      const prompt = `You are the Auditor agent for a transparency treasury. Given these agent findings, write a 2-sentence plain-English rationale for the recommendation "${recLabel(s.recommendation)}". Findings: ${JSON.stringify(
        s.findings.map((f) => ({ agent: f.agent, verdict: f.verdict, summary: f.summary })),
      )}`;
      const t = await callGemma(prompt);
      if (!t.trim()) throw new Error("empty");
      return t.trim();
    },
    () => s.findings.map((f) => `${f.agent}: ${f.summary}`).join(" "),
  );

  // Mark the auditor finding's source to reflect whether Gemma wrote the prose.
  const auditor = s.findings.find((f) => f.agent === "auditor");
  if (auditor) auditor.source = source === "gemma" ? "gemma" : "deterministic";

  return {
    verification: s.verification,
    findings: s.findings,
    recommendation: s.recommendation,
    approvedAmount: s.approvedAmount,
    rationale,
    anomalyScore: s.anomalyScore,
    reviewedAt: new Date().toISOString(),
  };
}
