"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<Response>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function SeedDemoButton({ reset = true, label }: { reset?: boolean; label?: string }) {
  const { busy, run } = useAction();
  return (
    <button
      className="btn btn-primary"
      disabled={busy}
      onClick={() =>
        run(() =>
          fetch("/api/synthetic", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: reset ? "reset_and_seed_fixed" : "seed_fixed" }),
          }),
        )
      }
    >
      {busy ? "Loading…" : label ?? "Load demo dataset"}
    </button>
  );
}

export function ReviewButton({ expenseId }: { expenseId: string }) {
  const { busy, run } = useAction();
  return (
    <button
      className="btn btn-primary"
      disabled={busy}
      onClick={() => run(() => fetch(`/api/expenses/${expenseId}/review`, { method: "POST" }))}
    >
      {busy ? "Running agents…" : "Run 4-agent review"}
    </button>
  );
}

export function DecisionButtons({
  expenseId,
  defaultAmount,
  suggestPartial,
}: {
  expenseId: string;
  defaultAmount: number;
  suggestPartial?: number;
}) {
  const { busy, run } = useAction();
  const [amount, setAmount] = useState(suggestPartial ?? defaultAmount);
  const decide = (decision: "approve" | "reject") =>
    run(() =>
      fetch(`/api/expenses/${expenseId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, approvedAmount: amount }),
      }),
    );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <span className="label" style={{ margin: 0 }}>Approve amount (₹)</span>
        <input
          className="input"
          style={{ width: 130 }}
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={() => decide("approve")}>
        {busy ? "…" : "Approve & transfer"}
      </button>
      <button className="btn btn-danger" disabled={busy} onClick={() => decide("reject")}>
        Reject
      </button>
    </div>
  );
}

export function ResetButton() {
  const { busy, run } = useAction();
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={() =>
        run(() =>
          fetch("/api/synthetic", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "reset" }),
          }),
        )
      }
    >
      {busy ? "…" : "Clear all data"}
    </button>
  );
}
