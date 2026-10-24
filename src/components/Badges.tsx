import { RECOMMENDATION_LABEL, VERIFICATION_LABEL } from "@/lib/format";

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="chip"
      style={{ color, borderColor: color + "55", background: color + "18" }}
    >
      {text}
    </span>
  );
}

const C = {
  ok: "#4e7a58",     // sage
  warn: "#b4832a",   // amber
  danger: "#a51d37", // red-wine
  info: "#c24b64",   // rose
  muted: "#94727b",  // mauve
};

export function VerificationBadge({ v }: { v?: string }) {
  if (!v) return <Pill text="Not reviewed" color={C.muted} />;
  const color =
    v === "verified" ? C.ok : v === "missing_evidence" ? C.warn : v === "suspicious" ? C.danger : C.danger;
  return <Pill text={VERIFICATION_LABEL[v] ?? v} color={color} />;
}

export function RecommendationBadge({ r }: { r?: string }) {
  if (!r) return null;
  const color =
    r === "approve_full" ? C.ok : r === "approve_partial" ? C.info : r === "reject" ? C.danger : C.warn;
  return <Pill text={RECOMMENDATION_LABEL[r] ?? r} color={color} />;
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    transferred: C.ok,
    approved: C.ok,
    partially_approved: C.info,
    rejected: C.danger,
    on_hold: C.warn,
    awaiting_human: C.warn,
    under_review: C.info,
    submitted: C.muted,
  };
  return <Pill text={s.replace(/_/g, " ")} color={map[s] ?? C.muted} />;
}

export function VerdictDot({ verdict }: { verdict: "pass" | "warn" | "fail" }) {
  const color = verdict === "pass" ? C.ok : verdict === "warn" ? C.warn : C.danger;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, display: "inline-block" }} />
      {verdict.toUpperCase()}
    </span>
  );
}
