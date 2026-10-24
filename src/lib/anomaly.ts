// Lightweight expense anomaly scoring.
//
// A small, transparent scoring model (not a black box) that flags expenses
// worth a closer look. Stands in for a scikit-learn IsolationForest-style score
// but is fully deterministic and explainable — each contribution is named.
// Returns a score in [0,1]; higher = more anomalous.

import type { Expense, Rule } from "./types";

export interface AnomalySignal {
  name: string;
  weight: number; // contribution to the score
  triggered: boolean;
  note: string;
}

export function scoreAnomaly(
  expense: Expense,
  rules: Rule[],
  context: { medianAmount: number; vendorSeenBefore: boolean },
): { score: number; signals: AnomalySignal[] } {
  const signals: AnomalySignal[] = [];
  const add = (name: string, weight: number, triggered: boolean, note: string) =>
    signals.push({ name, weight, triggered, note });

  // 1. Amount far above the typical expense for this campaign.
  const ratio = context.medianAmount > 0 ? expense.amount / context.medianAmount : 1;
  add(
    "amount_outlier",
    0.3,
    ratio >= 3,
    `Amount is ${ratio.toFixed(1)}x the median expense`,
  );

  // 2. Round-number amount (weak fraud signal on its own).
  add(
    "round_number",
    0.1,
    expense.amount % 1000 === 0 && expense.amount >= 10000,
    "Suspiciously round amount",
  );

  // 3. Vendor and recipient mismatch.
  add(
    "payee_mismatch",
    0.2,
    expense.vendor.trim().toLowerCase() !== expense.recipient.trim().toLowerCase(),
    "Vendor name differs from payment recipient",
  );

  // 4. Brand-new vendor.
  add(
    "new_vendor",
    0.1,
    !context.vendorSeenBefore,
    "First payment to this vendor",
  );

  // 5. Just under a manual-approval threshold (structuring).
  const threshold = rules.find((r) => r.kind === "manual_approval_above")?.amount;
  add(
    "threshold_structuring",
    0.3,
    Boolean(threshold && expense.amount >= threshold * 0.9 && expense.amount < threshold),
    threshold ? `Amount sits just under the ₹${threshold.toLocaleString("en-IN")} approval threshold` : "n/a",
  );

  const score = Math.min(
    1,
    signals.filter((s) => s.triggered).reduce((a, s) => a + s.weight, 0),
  );
  return { score: Number(score.toFixed(2)), signals };
}
