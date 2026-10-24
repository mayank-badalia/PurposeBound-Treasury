export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function shortHash(h: string, n = 10): string {
  if (!h) return "";
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Verified",
  missing_evidence: "Missing evidence",
  suspicious: "Suspicious",
  not_permitted: "Not permitted",
};

export const RECOMMENDATION_LABEL: Record<string, string> = {
  approve_full: "Approve fully",
  approve_partial: "Approve partially",
  request_evidence: "Request evidence",
  hold: "Hold",
  reject: "Reject",
};
