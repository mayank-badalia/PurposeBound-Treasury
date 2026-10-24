import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

// POST /api/webhooks/razorpay
// Verifies the X-Razorpay-Signature over the RAW body, then handles events.
// Configure the webhook URL (e.g. an ngrok tunnel to this route) and set
// RAZORPAY_WEBHOOK_SECRET. Recommended events: payment.captured, payment.failed,
// refund.processed, transfer.processed, transfer.failed, transfer.reversed.
export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw body required for signature
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    // Not configured yet — accept but mark unverified so it is obvious in logs.
    console.warn("[webhook] RAZORPAY_WEBHOOK_SECRET not set — event not verified");
    return NextResponse.json({ ok: true, verified: false, note: "webhook secret not configured" });
  }
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  let event = "unknown";
  try {
    event = (JSON.parse(raw) as { event?: string }).event || "unknown";
  } catch {
    /* ignore parse errors */
  }
  // For the demo we acknowledge and log; a production build would reconcile the
  // matching fund/transfer/refund record here.
  console.log("[webhook] verified Razorpay event:", event);
  return NextResponse.json({ ok: true, verified: true, event });
}
