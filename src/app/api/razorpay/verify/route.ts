import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { addFund, getCampaign } from "@/lib/store";
import { shortId } from "@/lib/hash";

export const runtime = "nodejs";

// POST /api/razorpay/verify
// { razorpay_order_id, razorpay_payment_id, razorpay_signature, campaign_id, amount, source? }
// Only records the contribution as captured AFTER the signature verifies.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const orderId = String(b.razorpay_order_id || "");
  const paymentId = String(b.razorpay_payment_id || "");
  const signature = String(b.razorpay_signature || "");
  const campaignId = String(b.campaign_id || "");
  const amount = Number(b.amount);

  if (!orderId || !paymentId || !signature || !campaignId || !amount) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }
  const campaign = await getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ ok: false, error: "campaign not found" }, { status: 404 });

  const valid = verifyPaymentSignature(orderId, paymentId, signature);
  if (!valid) {
    return NextResponse.json({ ok: false, verified: false, error: "signature verification failed" }, { status: 400 });
  }

  const fund = await addFund({
    id: shortId("fund"),
    campaignId,
    amount,
    source: String(b.source || "Contributor"),
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    status: "captured",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, verified: true, fund });
}
