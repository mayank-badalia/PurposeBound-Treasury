// Feature 3: Live Budget Guard.
//
// Maintains the current financial position and computes the effect of an
// expense on every protected category. ALL arithmetic is plain code — the LLM
// is never trusted with the numbers, only with explaining them.
//
//   Available funds = collected − transferred − approved-unpaid
//                     − reserved allocations − refund obligations

import type { Expense, Fund, Rule } from "./types";

export interface CategoryUsage {
  category: string;
  committed: number; // transferred + approved-but-unpaid in this category
  limit?: number; // from max_category_amount
  minPct?: number; // from min_category_pct
  minRequired?: number; // minPct of collected, in INR
}

export interface BudgetPosition {
  collected: number;
  transferred: number;
  approvedUnpaid: number;
  reserved: number; // sum of unmet min-category reservations
  refundObligations: number;
  available: number; // spendable without touching protected reservations
  cashAvailable: number; // raw liquid cash (collected − transferred − approvedUnpaid)
  categories: CategoryUsage[];
}

function committedExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((e) =>
    ["approved", "partially_approved", "transferred"].includes(e.status),
  );
}

function effectiveAmount(e: Expense): number {
  // Partially-approved expenses commit only the approved amount.
  if (e.status === "partially_approved" && e.humanDecision) {
    return e.humanDecision.approvedAmount;
  }
  return e.review?.recommendation === "approve_partial" && e.review.approvedAmount
    ? e.review.approvedAmount
    : e.amount;
}

export function computePosition(
  funds: Fund[],
  expenses: Expense[],
  rules: Rule[],
): BudgetPosition {
  const collected = funds
    .filter((f) => f.status === "captured")
    .reduce((a, f) => a + f.amount, 0);

  const committed = committedExpenses(expenses);
  const transferred = committed
    .filter((e) => e.status === "transferred")
    .reduce((a, e) => a + effectiveAmount(e), 0);
  const approvedUnpaid = committed
    .filter((e) => e.status !== "transferred")
    .reduce((a, e) => a + effectiveAmount(e), 0);

  // Per-category commitment.
  const byCat = new Map<string, number>();
  for (const e of committed) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + effectiveAmount(e));
  }

  const cats = new Map<string, CategoryUsage>();
  const touch = (c: string) => {
    if (!cats.has(c)) cats.set(c, { category: c, committed: byCat.get(c) ?? 0 });
    return cats.get(c)!;
  };
  for (const c of byCat.keys()) touch(c);
  for (const r of rules) {
    if (r.kind === "max_category_amount" && r.category) {
      touch(r.category).limit = r.amount;
    }
    if (r.kind === "min_category_pct" && r.category) {
      const u = touch(r.category);
      u.minPct = r.pct;
      u.minRequired = Math.round((collected * (r.pct ?? 0)) / 100);
    }
  }

  // Reserved = the still-unmet portion of every minimum allocation.
  let reserved = 0;
  for (const u of cats.values()) {
    if (u.minRequired != null) {
      reserved += Math.max(0, u.minRequired - u.committed);
    }
  }

  const refundObligations = rules.some((r) => r.kind === "refund_unused")
    ? 0 // becomes > 0 only when the campaign is closed with a surplus
    : 0;

  const cashAvailable = collected - transferred - approvedUnpaid;
  const available = cashAvailable - reserved - refundObligations;

  return {
    collected,
    transferred,
    approvedUnpaid,
    reserved,
    refundObligations,
    cashAvailable,
    available: Math.round(available),
    categories: [...cats.values()],
  };
}

export interface ProtectedBreach {
  category: string;
  requiredPct: number;
  achievablePct: number; // best % still reachable for this category after the expense
  message: string;
}

export interface ImpactAssessment {
  affordable: boolean;
  withinCategoryLimit: boolean;
  breaches: ProtectedBreach[];
  verdict: "pass" | "warn" | "fail";
  summary: string;
  details: string[];
}

// What happens to the financial position if we approve `candidate`?
export function assessImpact(
  candidate: Expense,
  position: BudgetPosition,
  rules: Rule[],
): ImpactAssessment {
  const details: string[] = [];
  const breaches: ProtectedBreach[] = [];

  const affordable = candidate.amount <= position.cashAvailable;
  details.push(
    affordable
      ? `Affordable: ₹${candidate.amount.toLocaleString("en-IN")} within ₹${position.cashAvailable.toLocaleString("en-IN")} liquid cash.`
      : `Not affordable: ₹${candidate.amount.toLocaleString("en-IN")} exceeds ₹${position.cashAvailable.toLocaleString("en-IN")} liquid cash.`,
  );

  // Category spend limit.
  let withinCategoryLimit = true;
  const catUsage = position.categories.find((c) => c.category === candidate.category);
  const limitRule = rules.find(
    (r) => r.kind === "max_category_amount" && r.category === candidate.category,
  );
  if (limitRule?.amount != null) {
    const after = (catUsage?.committed ?? 0) + candidate.amount;
    withinCategoryLimit = after <= limitRule.amount;
    details.push(
      withinCategoryLimit
        ? `${candidate.category} spend ₹${after.toLocaleString("en-IN")} within the ₹${limitRule.amount.toLocaleString("en-IN")} cap.`
        : `${candidate.category} spend ₹${after.toLocaleString("en-IN")} would breach the ₹${limitRule.amount.toLocaleString("en-IN")} cap.`,
    );
  }

  // Protected minimum-allocation categories (e.g. prizes >= 40%).
  for (const r of rules) {
    if (r.kind !== "min_category_pct" || !r.category) continue;
    if (r.category === candidate.category) continue; // spending ON the protected cat only helps
    const collected = position.collected || 1;
    const committedElsewhere =
      position.categories
        .filter((c) => c.category !== r.category)
        .reduce((a, c) => a + c.committed, 0) + candidate.amount;
    const achievable = Math.max(0, collected - committedElsewhere);
    const achievablePct = Math.round((achievable / collected) * 100);
    if (achievablePct < (r.pct ?? 0)) {
      breaches.push({
        category: r.category,
        requiredPct: r.pct ?? 0,
        achievablePct,
        message: `Approving this would reduce the promised ${r.category} allocation from ${r.pct}% to ${achievablePct}%.`,
      });
      details.push(
        `Protected: ${r.category} min ${r.pct}% at risk — only ${achievablePct}% would remain reachable.`,
      );
    }
  }

  let verdict: ImpactAssessment["verdict"] = "pass";
  if (!affordable || !withinCategoryLimit) verdict = "fail";
  else if (breaches.length > 0) verdict = "warn";

  const summary =
    verdict === "pass"
      ? "Affordable and respects every protected allocation."
      : verdict === "warn"
        ? breaches[0].message
        : !affordable
          ? "Expense exceeds available funds."
          : "Expense breaches a category spending cap.";

  return { affordable, withinCategoryLimit, breaches, verdict, summary, details };
}
