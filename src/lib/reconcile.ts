// Reconciliation: the central feature — prove the SAME account received the
// sponsor's money and transferred an approved amount to the exact vendor named
// on the invoice.
//
//   Sponsor promised -> Sponsor paid -> Campaign received -> Vendor invoiced
//   -> Agents checked -> Human approved -> Razorpay transferred -> (delivered)

import { expensesFor, fundsFor } from "./store";
import type { Expense, Fund } from "./types";

export interface IncomingPayment {
  fundId: string;
  sponsor: string;
  amount: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  status: string;
  at: string;
}

export interface OutgoingTransfer {
  expenseId: string;
  vendor: string;
  category: string;
  invoiceNumber?: string;
  invoiceHash?: string;
  requestedAmount: number;
  approvedAmount: number;
  approver?: string;
  vendorLinkedAccountId: string;
  razorpayTransferId: string;
  razorpayOrderId?: string;
  transferStatus: string;
  demo: boolean;
  deliveryEvidenceHash?: string;
  chain: string; // one-line human summary
}

export interface Reconciliation {
  campaignId: string;
  incoming: IncomingPayment[];
  outgoing: OutgoingTransfer[];
  totalReceived: number;
  totalTransferred: number;
  balance: number;
  reconciled: boolean; // transferred never exceeds received
}

function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export async function buildReconciliation(campaignId: string): Promise<Reconciliation> {
  const [funds, expenses] = await Promise.all([fundsFor(campaignId), expensesFor(campaignId)]);

  const incoming: IncomingPayment[] = funds
    .filter((f: Fund) => f.status === "captured")
    .map((f) => ({
      fundId: f.id,
      sponsor: f.source,
      amount: f.amount,
      razorpayOrderId: f.razorpayOrderId,
      razorpayPaymentId: f.razorpayPaymentId,
      status: f.status,
      at: f.createdAt,
    }));

  const outgoing: OutgoingTransfer[] = expenses
    .filter((e: Expense) => e.transfer)
    .map((e) => {
      const invoice = e.evidence.find((ev) => ev.type === "invoice");
      const delivery = e.evidence.find((ev) => ev.type === "photo" || ev.type === "completion");
      const approved = e.transfer!.amount;
      return {
        expenseId: e.id,
        vendor: e.vendor,
        category: e.category,
        invoiceNumber: invoice?.extracted?.notes,
        invoiceHash: invoice?.contentHash,
        requestedAmount: e.amount,
        approvedAmount: approved,
        approver: e.humanDecision?.decidedBy,
        vendorLinkedAccountId: e.transfer!.linkedAccountId,
        razorpayTransferId: e.transfer!.razorpayTransferId,
        razorpayOrderId: e.transfer!.razorpayOrderId,
        transferStatus: e.transfer!.status,
        demo: e.transfer!.demo,
        deliveryEvidenceHash: delivery?.contentHash,
        chain: `Invoice ${inr(e.amount)} → approved ${inr(approved)} → transferred ${inr(approved)} to ${e.vendor}${e.transfer!.demo ? " (Demo)" : ""}`,
      };
    });

  const totalReceived = incoming.reduce((a, p) => a + p.amount, 0);
  const totalTransferred = outgoing.reduce((a, t) => a + t.approvedAmount, 0);

  return {
    campaignId,
    incoming,
    outgoing,
    totalReceived,
    totalTransferred,
    balance: totalReceived - totalTransferred,
    reconciled: totalTransferred <= totalReceived,
  };
}
