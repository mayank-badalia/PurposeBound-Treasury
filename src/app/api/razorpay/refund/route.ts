import { NextRequest, NextResponse } from "next/server";
import { refundPayment } from "@/lib/razorpay";

export const runtime = "nodejs";

// POST /api/razorpay/refund  { payment_id, amount? }  (amount in rupees; omit for full)
// Used for rejected contributions, unused-fund returns, failed-purpose campaigns.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const paymentId = String(b.payment_id || b.paymentId || "");
  if (!paymentId) return NextResponse.json({ ok: false, error: "payment_id required" }, { status: 400 });
  const amount = b.amount != null ? Number(b.amount) : undefined;
  const refund = await refundPayment(paymentId, amount);
  return NextResponse.json({ ok: true, refund });
}
