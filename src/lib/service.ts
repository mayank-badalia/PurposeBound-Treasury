// Application service layer — the verified chain, wired end to end.
//   submit -> anchor -> review (4 agents) -> human decision -> transfer -> anchor

import { runReview } from "./agents";
import { buildReport } from "./report";
import { routeTransfer } from "./razorpay";
import { shortId } from "./hash";
import {
  addFund,
  anchor,
  anchorsFor,
  expensesFor,
  fundsFor,
  getCampaign,
  getExpense,
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
export async function installDataset(ds: Dataset): Promise<string> {
  await upsertCampaign(ds.campaign);
  await replaceRules(ds.campaign.id, ds.rules);
  for (const f of ds.funds) await addFund(f);
  for (const e of ds.expenses) await upsertExpense(e);
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
  const partial = amount < expense.amount;

  const transfer = await routeTransfer(amount, shortId("acc"));
  expense.transfer = {
    id: shortId("trf"),
    expenseId: expense.id,
    amount,
    razorpayTransferId: transfer.transferId,
    linkedAccountId: transfer.linkedAccountId,
    status: transfer.status,
    createdAt: new Date().toISOString(),
  };
  expense.status = transfer.status === "processed" ? "transferred" : "on_hold";
  if (partial) expense.humanDecision.approvedAmount = amount;

  await upsertExpense(expense);
  await anchor(expense.campaignId, "transfer", expense.transfer.id, JSON.stringify({
    amount,
    razorpayTransferId: transfer.transferId,
  }));
  return expense;
}

export async function campaignReport(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const [rules, funds, expenses, anchors] = await Promise.all([
    rulesFor(campaignId),
    fundsFor(campaignId),
    expensesFor(campaignId),
    anchorsFor(campaignId),
  ]);
  return buildReport(campaign, rules, funds, expenses, anchors);
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
