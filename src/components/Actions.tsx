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
  blocked = false,
  blockReason = "",
}: {
  expenseId: string;
  defaultAmount: number;
  suggestPartial?: number;
  blocked?: boolean;
  blockReason?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(suggestPartial ?? defaultAmount);
  const [override, setOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/expenses/${expenseId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, approvedAmount: amount, override: override.trim() || undefined }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error || "Failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const approveDisabled = busy || (blocked && !override.trim());

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {blocked && (
        <div style={{ border: "1px solid var(--danger)", background: "rgba(248,113,113,0.1)", borderRadius: 10, padding: 10 }}>
          <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 13 }}>⛔ Transfer blocked by the agents</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{blockReason}</div>
          <input
            className="input"
            style={{ marginTop: 8 }}
            placeholder="Exceptional-authority override reason (required to approve anyway)…"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <span className="label" style={{ margin: 0 }}>Approve amount (₹)</span>
          <input className="input" style={{ width: 130 }} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <button
          className="btn btn-primary"
          disabled={approveDisabled}
          title={approveDisabled && blocked ? "Enter an override reason to approve a flagged expense" : ""}
          onClick={() => decide("approve")}
        >
          {busy ? "…" : blocked ? "Override & transfer" : "Approve & transfer"}
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={() => decide("reject")}>
          Reject
        </button>
      </div>
      {err && <div className="chip" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>{err}</div>}
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
