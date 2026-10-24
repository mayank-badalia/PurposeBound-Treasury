import { NextRequest, NextResponse } from "next/server";
import { addFund, getCampaign } from "@/lib/store";
import { collectFunds } from "@/lib/razorpay";
import { shortId } from "@/lib/hash";

export const runtime = "nodejs";

// Collect funds through Razorpay (Sandbox or mock).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount required" }, { status: 400 });
  }
  const order = await collectFunds(amount, `receipt_${id}`);
  const fund = await addFund({
    id: shortId("fund"),
    campaignId: id,
    amount,
    source: body.source || "Donor",
    razorpayOrderId: order.orderId,
    razorpayPaymentId: order.paymentId,
    status: "captured",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, fund, mode: order.mode });
}
