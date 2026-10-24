// Feature 5: Verifiable Transparency Report.
//
// A live snapshot of where every rupee stands against the declared purpose,
// plus a plain-language narrative (Gemma when configured, deterministic
// otherwise) and the hash anchors that prove nothing was silently changed.

import { computePosition } from "./budget";
import { callGemma, sanitizeCurrency, withGemma, type GemmaMode } from "./gemma";
import type { Campaign, Expense, Fund, HashAnchor, Rule } from "./types";

export interface TransparencyReport {
  campaign: Campaign;
  collected: number;
  spent: number; // transferred
  committed: number; // approved but not yet transferred
  remaining: number;
  categories: {
    category: string;
    committed: number;
    limit?: number;
    minRequired?: number;
    minPct?: number;
    status: "ok" | "over_cap" | "below_min";
  }[];
  expenses: {
    id: string;
    category: string;
    vendor: string;
    amount: number;
    status: string;
    verification?: string;
    recommendation?: string;
  }[];
  refunds: number;
  anchors: HashAnchor[];
  compliance: { rule: string; status: "met" | "at_risk" | "pending" }[];
  narrative: string;
  narrativeSource: GemmaMode;
}

export async function buildReport(
  campaign: Campaign,
  rules: Rule[],
  funds: Fund[],
  expenses: Expense[],
  anchors: HashAnchor[],
  opts: { llm?: boolean } = {},
): Promise<TransparencyReport> {
  const useLlm = opts.llm !== false;
  const pos = computePosition(funds, expenses, rules);
  const spent = pos.transferred;
  const committed = pos.approvedUnpaid;
  const remaining = pos.collected - spent - committed;

  const categories = pos.categories.map((c) => {
    let status: "ok" | "over_cap" | "below_min" = "ok";
    if (c.limit != null && c.committed > c.limit) status = "over_cap";
    if (c.minRequired != null && c.committed < c.minRequired) status = "below_min";
    return {
      category: c.category,
      committed: c.committed,
      limit: c.limit,
      minRequired: c.minRequired,
      minPct: c.minPct,
      status,
    };
  });

  const compliance = rules.map((r) => {
    let status: "met" | "at_risk" | "pending" = "pending";
    if (r.kind === "min_category_pct" && r.category) {
      const cat = categories.find((c) => c.category === r.category);
      status = cat && cat.committed >= (cat.minRequired ?? 0) ? "met" : "at_risk";
    } else if (r.kind === "max_category_amount" && r.category) {
      const cat = categories.find((c) => c.category === r.category);
      status = !cat || cat.committed <= (r.amount ?? Infinity) ? "met" : "at_risk";
    } else {
      status = "met";
    }
    return { rule: r.label, status };
  });

  const reportExpenses = expenses.map((e) => ({
    id: e.id,
    category: e.category,
    vendor: e.vendor,
    amount: e.amount,
    status: e.status,
    verification: e.review?.verification,
    recommendation: e.review?.recommendation,
  }));

  const summaryFacts = {
    collected: pos.collected,
    spent,
    committed,
    remaining,
    categories: categories.map((c) => ({ category: c.category, committed: c.committed, status: c.status })),
    expensesApproved: expenses.filter((e) => ["approved", "partially_approved", "transferred"].includes(e.status)).length,
    expensesRejected: expenses.filter((e) => e.status === "rejected").length,
  };

  const fallbackNarrative = () =>
    `Of ₹${pos.collected.toLocaleString("en-IN")} collected, ₹${spent.toLocaleString("en-IN")} has been transferred to verified vendors and ₹${committed.toLocaleString("en-IN")} is approved and pending, leaving ₹${remaining.toLocaleString("en-IN")}. ${
      compliance.every((c) => c.status !== "at_risk")
        ? "All declared-purpose commitments are currently on track."
        : "One or more declared-purpose commitments are at risk and flagged above."
    } Every rule, expense, piece of evidence and transfer is hash-anchored for tamper-evident verification.`;

  const { value: narrative, source } = useLlm
    ? await withGemma<string>(
        async () => {
          const t = await callGemma(
            `Write a 3-sentence donor/sponsor transparency summary for "${campaign.name}". All amounts are in Indian Rupees — always write the ₹ symbol, never "$" or "dollars". Use plain language, mention how much was spent vs remaining and whether the declared purpose is being honoured. Facts (amounts in INR): ${JSON.stringify(summaryFacts)}`,
          );
          if (!t.trim()) throw new Error("empty");
          return sanitizeCurrency(t.trim());
        },
        fallbackNarrative,
      )
    : { value: fallbackNarrative(), source: "fallback" as const };

  return {
    campaign,
    collected: pos.collected,
    spent,
    committed,
    remaining,
    categories,
    expenses: reportExpenses,
    refunds: pos.refundObligations,
    anchors,
    compliance,
    narrative,
    narrativeSource: source,
  };
}
