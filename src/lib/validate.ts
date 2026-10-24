// Validation: input -> application output -> expected output.
//
// Runs every synthetic expense that carries an expected outcome through the
// REAL 4-agent pipeline and compares. A run passes only when the result is
// correct — not merely when it finished without error. Expected outputs are
// never edited to make wrong output pass.

import { runReview } from "./agents";
import { expensesFor, fundsFor, rulesFor } from "./store";
import type { Recommendation, VerificationResult } from "./types";

export interface ScenarioResult {
  expenseId: string;
  scenario: string;
  category: string;
  amount: number;
  expected: { verification: VerificationResult; recommendation: Recommendation };
  actual: { verification: VerificationResult; recommendation: Recommendation };
  anomalyScore: number;
  pass: boolean;
  rationale: string;
}

export interface ValidationSummary {
  campaignId: string;
  total: number;
  passed: number;
  failed: number;
  results: ScenarioResult[];
}

export async function validateCampaign(campaignId: string): Promise<ValidationSummary> {
  const [rules, funds, expenses] = await Promise.all([
    rulesFor(campaignId),
    fundsFor(campaignId),
    expensesFor(campaignId),
  ]);

  const withExpected = expenses.filter((e) => e.expected);
  const results: ScenarioResult[] = [];

  for (const expense of withExpected) {
    // Deterministic review (no Gemma call) — validation must be free & fast.
    const review = await runReview({ expense, rules, funds, campaignExpenses: expenses }, { llm: false });
    const expected = {
      verification: expense.expected!.verification,
      recommendation: expense.expected!.recommendation,
    };
    const actual = { verification: review.verification, recommendation: review.recommendation };
    const pass =
      actual.verification === expected.verification &&
      actual.recommendation === expected.recommendation;
    results.push({
      expenseId: expense.id,
      scenario: expense.expected!.scenario,
      category: expense.category,
      amount: expense.amount,
      expected,
      actual,
      anomalyScore: review.anomalyScore,
      pass,
      rationale: review.rationale,
    });
  }

  return {
    campaignId,
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}
