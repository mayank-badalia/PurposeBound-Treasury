// Razorpay Sandbox + Route.
//
// Collecting funds uses Orders; paying a verified vendor uses Route transfers to
// a linked account. With RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET set we call the
// live Sandbox API (test credentials, no real money). Otherwise we return
// realistic simulated IDs so the whole chain demos offline.

import { createHmac, timingSafeEqual } from "crypto";
import { shortId } from "./hash";

export type RazorpayMode = "sandbox" | "mock";

export function razorpayMode(): RazorpayMode {
  return process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? "sandbox"
    : "mock";
}

function auth(): string {
  return Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
}

export interface OrderResult {
  orderId: string;
  paymentId: string;
  amount: number;
  mode: RazorpayMode;
}

// Simulate collecting funds (an Order + a captured test Payment).
export async function collectFunds(amountInr: number, receipt: string): Promise<OrderResult> {
  if (razorpayMode() === "sandbox") {
    try {
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { authorization: `Basic ${auth()}`, "content-type": "application/json" },
        body: JSON.stringify({ amount: amountInr * 100, currency: "INR", receipt }),
      });
      if (res.ok) {
        const o = (await res.json()) as { id: string };
        return { orderId: o.id, paymentId: shortId("pay"), amount: amountInr, mode: "sandbox" };
      }
    } catch (err) {
      console.warn("[razorpay] order fell back to mock:", (err as Error).message);
    }
  }
  return {
    orderId: shortId("order"),
    paymentId: shortId("pay"),
    amount: amountInr,
    mode: "mock",
  };
}

export interface TransferResult {
  transferId: string;
  linkedAccountId: string;
  amount: number;
  status: "processed" | "failed";
  mode: RazorpayMode;
}

// Route transfer to a vendor's linked account after human approval.
export async function routeTransfer(
  amountInr: number,
  linkedAccountId: string,
): Promise<TransferResult> {
  if (razorpayMode() === "sandbox") {
    try {
      const res = await fetch("https://api.razorpay.com/v1/transfers", {
        method: "POST",
        headers: { authorization: `Basic ${auth()}`, "content-type": "application/json" },
        body: JSON.stringify({ account: linkedAccountId, amount: amountInr * 100, currency: "INR" }),
      });
      if (res.ok) {
        const t = (await res.json()) as { id: string };
        return { transferId: t.id, linkedAccountId, amount: amountInr, status: "processed", mode: "sandbox" };
      }
    } catch (err) {
      console.warn("[razorpay] transfer fell back to mock:", (err as Error).message);
    }
  }
  return {
    transferId: shortId("trf"),
    linkedAccountId: linkedAccountId || shortId("acc"),
    amount: amountInr,
    status: "processed",
    mode: "mock",
  };
}

// Verify a Razorpay Checkout callback signature:
//   HMAC_SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

// Verify a Razorpay webhook signature: HMAC_SHA256(rawBody, webhook_secret).
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  amount: number;
  status: string;
  mode: RazorpayMode;
}

// Refund a captured payment (full or partial). Used for rejected contributions,
// unused-fund returns and failed-purpose campaigns.
export async function refundPayment(paymentId: string, amountInr?: number): Promise<RefundResult> {
  if (razorpayMode() === "sandbox") {
    try {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { authorization: `Basic ${auth()}`, "content-type": "application/json" },
        body: JSON.stringify(amountInr ? { amount: amountInr * 100 } : {}),
      });
      if (res.ok) {
        const r = (await res.json()) as { id: string; amount: number; status: string };
        return { refundId: r.id, paymentId, amount: (r.amount ?? 0) / 100, status: r.status, mode: "sandbox" };
      }
    } catch (err) {
      console.warn("[razorpay] refund fell back to mock:", (err as Error).message);
    }
  }
  return { refundId: shortId("rfnd"), paymentId, amount: amountInr ?? 0, status: "processed", mode: "mock" };
}
