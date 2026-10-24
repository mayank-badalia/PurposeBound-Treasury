"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Razorpay Checkout types (minimal).
interface RzpResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open: () => void };
}
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function SponsorPayment({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sponsor, setSponsor] = useState("TechCorp Sponsorship");
  const [amount, setAmount] = useState(100000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void loadCheckout();
  }, []);

  const request = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // 1. Create the Razorpay order on the backend.
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, amount }),
      });
      const o = await res.json();
      if (!o.ok) {
        setMsg({ ok: false, text: o.error || "order failed" });
        return;
      }

      // 2a. Mock mode (no live keys): credit directly for the demo.
      if (o.mode === "mock" || !o.key_id) {
        await fetch(`/api/campaigns/${campaignId}/funds`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount, source: sponsor }),
        });
        setMsg({ ok: true, text: `Credited ₹${amount.toLocaleString("en-IN")} (mock)` });
        router.refresh();
        return;
      }

      // 2b. Live sandbox: open real Razorpay Checkout.
      const ready = await loadCheckout();
      if (!ready || !window.Razorpay) {
        setMsg({ ok: false, text: "Could not load Razorpay Checkout" });
        return;
      }
      const rzp = new window.Razorpay({
        key: o.key_id,
        order_id: o.order_id,
        amount: o.amount,
        currency: o.currency,
        name: "PurposeBound Treasury",
        description: `Sponsor contribution — ${o.campaign_name}`,
        prefill: { name: sponsor },
        theme: { color: "#34d399" },
        handler: async (resp: RzpResponse) => {
          // 3. Verify the signature server-side, then credit the campaign.
          const v = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              campaign_id: campaignId,
              amount,
              source: sponsor,
            }),
          });
          const vj = await v.json();
          setMsg(
            vj.verified
              ? { ok: true, text: `Payment verified & credited (${resp.razorpay_payment_id})` }
              : { ok: false, text: "Signature verification failed" },
          );
          router.refresh();
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Request sponsor payment
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 10, minWidth: 320 }}>
      <div style={{ fontWeight: 800 }}>Request sponsor payment</div>
      <div>
        <span className="label">Sponsor</span>
        <input className="input" value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
      </div>
      <div>
        <span className="label">Installment amount (₹)</span>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy || !amount} onClick={request}>
          {busy ? "Creating order…" : "Create order & open Checkout"}
        </button>
        <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && (
        <div className="chip" style={{ color: msg.ok ? "var(--ok)" : "var(--danger)", borderColor: msg.ok ? "var(--ok)" : "var(--danger)" }}>
          {msg.text}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Test card: 4111 1111 1111 1111 · any future expiry · any CVV. Real Razorpay test order → signature verified → campaign credited.
      </div>
    </div>
  );
}
