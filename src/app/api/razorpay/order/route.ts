import { NextRequest, NextResponse } from "next/server";
import { collectFunds } from "@/lib/razorpay";
import { getCampaign } from "@/lib/store";

export const runtime = "nodejs";

// POST /api/razorpay/order  { campaign_id, amount }  (amount in rupees)
// Creates a Razorpay order and returns the public Key ID for Checkout.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaign_id || body.campaignId || "");
  const amount = Number(body.amount);
  if (!campaignId || !amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "campaign_id and positive amount required" }, { status: 400 });
  }
  const campaign = await getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ ok: false, error: "campaign not found" }, { status: 404 });

  const order = await collectFunds(amount, `receipt_${campaignId}`);
  return NextResponse.json({
    ok: true,
    mode: order.mode,
    order_id: order.orderId,
    key_id: process.env.RAZORPAY_KEY_ID ?? "",
    amount: amount * 100, // paise, for Checkout
    currency: "INR",
    campaign_name: campaign.name,
  });
}
