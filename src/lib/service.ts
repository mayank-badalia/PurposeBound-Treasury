// Application service layer — the verified chain, wired end to end.
//   submit -> anchor -> review (4 agents) -> human decision -> transfer -> anchor

import { runReview } from "./agents";
import { buildReport } from "./report";
import { routeTransfer } from "./razorpay";
import { gemmaMode } from "./gemma";
import { shortId, sha256 } from "./hash";
import {
  anchor,
  anchorsFor,
  clearAnchors,
  expensesFor,
  fundsFor,
  getCampaign,
  getExpense,
  replaceExpenses,
  replaceFunds,
  replaceRules,
  rulesFor,
  upsertCampaign,
  upsertExpense,
} from "./store";
import {
  buildFixedDataset,
  generateDataset,
  type Dataset,
  type GenerateOptions,
} from "./synthetic";
import type { Evidence, Expense, HumanDecision } from "./types";

// Persist a whole dataset (fixed or generated) and anchor its locked rules.
// Idempotent: re-installing the same campaign replaces its rules/funds/expenses
// and clears its old anchors, so re-seeding never doubles the collected amount.
export async function installDataset(ds: Dataset): Promise<string> {
  await upsertCampaign(ds.campaign);
  await clearAnchors(ds.campaign.id);
  await replaceRules(ds.campaign.id, ds.rules);
  await replaceFunds(ds.campaign.id, ds.funds);
  await replaceExpenses(ds.campaign.id, ds.expenses);
  await anchor(ds.campaign.id, "rules", ds.campaign.id, JSON.stringify(ds.rules.map((r) => r.label)));
  for (const e of ds.expenses) {
    await anchor(ds.campaign.id, "expense", e.id, JSON.stringify({ category: e.category, amount: e.amount, vendor: e.vendor }));
    for (const ev of e.evidence) {
      await anchor(ds.campaign.id, "evidence", ev.id, ev.contentHash);
    }
  }
  return ds.campaign.id;
}

export async function seedFixedDataset(): Promise<string> {
  return installDataset(buildFixedDataset());
}

export async function seedGenerated(opts: GenerateOptions): Promise<string> {
  return installDataset(generateDataset(opts));
}

export interface SubmitInput {
  campaignId: string;
  category: string;
  amount: number;
  vendor: string;
  recipient: string;
  vendorLinkedAccountId?: string;
  description: string;
  evidence: Evidence[];
}

export async function submitExpense(input: SubmitInput): Promise<Expense> {
  const now = new Date().toISOString();
  const expense: Expense = {
    id: shortId("exp"),
    campaignId: input.campaignId,
    category: input.category.trim().toLowerCase(),
    amount: input.amount,
    vendor: input.vendor.trim(),
    recipient: input.recipient.trim() || input.vendor.trim(),
    vendorLinkedAccountId: input.vendorLinkedAccountId?.trim() || undefined,
    description: input.description.trim(),
    status: "submitted",
    createdAt: now,
    evidence: input.evidence.map((e) => ({ ...e, uploadedAt: now })),
    synthetic: false,
  };
  await upsertExpense(expense);
  await anchor(input.campaignId, "expense", expense.id, JSON.stringify({ category: expense.category, amount: expense.amount, vendor: expense.vendor }));
  for (const ev of expense.evidence) {
    await anchor(input.campaignId, "evidence", ev.id, ev.contentHash);
  }
  return expense;
}

// Run the 4-agent pipeline on an expense and persist the review.
export async function reviewExpense(expenseId: string): Promise<Expense> {
  const expense = await getExpense(expenseId);
  if (!expense) throw new Error("Expense not found");
  const rules = await rulesFor(expense.campaignId);
  const funds = await fundsFor(expense.campaignId);
  const campaignExpenses = await expensesFor(expense.campaignId);

  const review = await runReview({ expense, rules, funds, campaignExpenses });
  expense.review = review;
  expense.status = "awaiting_human"; // a human must confirm before any transfer
  await upsertExpense(expense);
  return expense;
}

// Human confirms the recommendation. Approval triggers the Razorpay transfer.
export async function decideExpense(
  expenseId: string,
  decision: Omit<HumanDecision, "decidedAt">,
): Promise<Expense> {
  const expense = await getExpense(expenseId);
  if (!expense) throw new Error("Expense not found");

  expense.humanDecision = { ...decision, decidedAt: new Date().toISOString() };

  if (decision.decision === "reject") {
    expense.status = "rejected";
    await upsertExpense(expense);
    return expense;
  }

  const amount = decision.approvedAmount || expense.amount;

  // Transfer to the vendor's linked account when provided (ties the outgoing
  // transfer to the exact vendor); otherwise a per-expense placeholder account.
  const vendorAccount = expense.vendorLinkedAccountId || `acc_${expense.id.slice(4, 18)}`;
  const transfer = await routeTransfer(amount, vendorAccount);
  expense.transfer = {
    id: shortId("trf"),
    expenseId: expense.id,
    amount,
    razorpayTransferId: transfer.transferId,
    linkedAccountId: transfer.linkedAccountId,
    status: transfer.status,
    demo: transfer.mode === "mock", // simulated until Route is enabled
    createdAt: new Date().toISOString(),
  };
  expense.status = transfer.status === "processed" ? "transferred" : "on_hold";
  // Record the actual approved amount (full or partial) as the human decision.
  expense.humanDecision.approvedAmount = amount;

  await upsertExpense(expense);
  await anchor(expense.campaignId, "transfer", expense.transfer.id, JSON.stringify({
    amount,
    razorpayTransferId: transfer.transferId,
  }));
  return expense;
}

// Cache the Gemma narrative per campaign + financial state, so the report loads
// instantly and only spends a Gemma call when the numbers actually change.
const narrativeCache = (globalThis as unknown as {
  __pbtNarr?: Map<string, { stateHash: string; text: string }>;
}).__pbtNarr ??= new Map();

export async function campaignReport(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const [rules, funds, expenses, anchors] = await Promise.all([
    rulesFor(campaignId),
    fundsFor(campaignId),
    expensesFor(campaignId),
    anchorsFor(campaignId),
  ]);

  // Always build deterministically first — instant, correct, free.
  const report = await buildReport(campaign, rules, funds, expenses, anchors, { llm: false });

  if (gemmaMode() === "gemma") {
    const stateHash = sha256(
      `${report.collected}|${report.spent}|${report.committed}|${JSON.stringify(report.compliance)}`,
    );
    const cached = narrativeCache.get(campaignId);
    if (cached && cached.stateHash === stateHash) {
      report.narrative = cached.text;
      report.narrativeSource = "gemma";
    } else {
      try {
        const g = await buildReport(campaign, rules, funds, expenses, anchors, { llm: true });
        if (g.narrativeSource === "gemma") {
          report.narrative = g.narrative;
          report.narrativeSource = "gemma";
          narrativeCache.set(campaignId, { stateHash, text: g.narrative });
        }
      } catch {
        /* keep the deterministic narrative on any Gemma failure */
      }
    }
  }
  return report;
}

// Explicitly anchor a finalised report snapshot (called from the report action,
// not on every read, so the anchor log stays meaningful).
export async function anchorReport(campaignId: string): Promise<void> {
  const report = await campaignReport(campaignId);
  await anchor(campaignId, "report", `report_${Date.now()}`, JSON.stringify({
    collected: report.collected,
    spent: report.spent,
    remaining: report.remaining,
  }));
}
