import { NextRequest, NextResponse } from "next/server";
import { routeTransfer } from "@/lib/razorpay";

export const runtime = "nodejs";

// POST /api/razorpay/transfer  { amount, account_id }
// Route transfer to a linked vendor account. Must run only after the purpose
// rule passed, evidence was verified, the budget check passed and a human
// approved — the approval pipeline enforces that; this is the raw transfer call.
// Works live once Route is enabled on the account; otherwise returns a labeled mock.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const amount = Number(b.amount);
  const accountId = String(b.account_id || b.linked_account_id || "");
  if (!amount || amount <= 0 || !accountId) {
    return NextResponse.json({ ok: false, error: "amount and account_id required" }, { status: 400 });
  }
  const transfer = await routeTransfer(amount, accountId);
  return NextResponse.json({ ok: true, transfer });
}
