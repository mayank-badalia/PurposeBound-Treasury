// Core domain types for PurposeBound Treasury.
// "Every rupee connected to its promised purpose."
//
// The verified financial chain, as types:
//   Campaign -> Rule -> Fund -> Expense -> Evidence -> AgentReview
//            -> HumanDecision -> Transfer -> Report
// Each important step gets a HashAnchor (tamper-proof SHA-256).

export type RuleKind =
  | "min_category_pct" // at least X% must go to <category>
  | "max_category_amount" // <category> spend cannot exceed ₹X
  | "requires_invoice" // vendor payments require an invoice
  | "refund_unused" // unused funds must be refunded
  | "manual_approval_above" // expenses above ₹X require manual approval
  | "forbidden_category"; // <category> is not permitted at all

export interface Rule {
  id: string;
  campaignId: string;
  kind: RuleKind;
  label: string; // human-readable, e.g. "At least 40% must be used for prizes"
  category?: string; // for category-scoped rules
  pct?: number; // for min_category_pct (0-100)
  amount?: number; // for amount-based rules (INR)
  confirmed: boolean;
  source: "gemma" | "fallback" | "manual";
}

export interface Campaign {
  id: string;
  name: string;
  organiser: string;
  description: string;
  sourceDocument: string; // the funding agreement / proposal text
  status: "draft" | "rules_locked" | "active" | "closed";
  rulesLocked: boolean;
  createdAt: string;
  synthetic: boolean;
}

export interface Fund {
  id: string;
  campaignId: string;
  amount: number;
  source: string; // sponsor / donor / fundraiser label
  razorpayOrderId: string;
  razorpayPaymentId: string;
  status: "captured" | "pending" | "refunded";
  createdAt: string;
}

export type EvidenceType = "invoice" | "receipt" | "photo" | "completion";

export interface Evidence {
  id: string;
  expenseId: string;
  type: EvidenceType;
  filename: string;
  mimeType: string;
  size: number;
  contentHash: string; // sha256 of bytes -> exact-duplicate detection
  visualFingerprint: string; // byte-histogram fingerprint -> near-duplicate detection
  uploadedAt: string;
  driveFileId?: string; // Google Drive file id (real or simulated)
  // What Gemma (or the fallback) extracted from the document/image:
  extracted?: {
    vendor?: string;
    amount?: number;
    date?: string;
    description?: string;
    supportsClaim?: boolean;
    notes?: string;
  };
}

export type ExpenseStatus =
  | "submitted"
  | "under_review"
  | "awaiting_human"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "on_hold"
  | "transferred";

export type VerificationResult =
  | "verified"
  | "missing_evidence"
  | "suspicious"
  | "not_permitted";

export interface AgentFinding {
  agent: "policy" | "evidence" | "budget" | "auditor";
  verdict: "pass" | "warn" | "fail";
  summary: string;
  details: string[];
  source: "gemma" | "deterministic";
}

export type Recommendation =
  | "approve_full"
  | "approve_partial"
  | "request_evidence"
  | "hold"
  | "reject";

export interface AgentReview {
  verification: VerificationResult;
  findings: AgentFinding[];
  recommendation: Recommendation;
  approvedAmount: number; // for approve_partial
  rationale: string; // auditor-synthesised, Gemma or deterministic
  anomalyScore: number; // 0-1 from the lightweight model
  reviewedAt: string;
}

export interface HumanDecision {
  decision: "approve" | "reject";
  approvedAmount: number;
  decidedBy: string;
  note: string;
  decidedAt: string;
}

export interface Transfer {
  id: string;
  expenseId: string;
  amount: number;
  razorpayTransferId: string;
  linkedAccountId: string;
  status: "processed" | "failed";
  createdAt: string;
}

export interface Expense {
  id: string;
  campaignId: string;
  category: string;
  amount: number;
  vendor: string;
  recipient: string;
  description: string;
  status: ExpenseStatus;
  createdAt: string;
  evidence: Evidence[];
  review?: AgentReview;
  humanDecision?: HumanDecision;
  transfer?: Transfer;
  synthetic: boolean;
  // Only present on synthetic records: what the app is expected to produce.
  expected?: ExpectedOutcome;
}

export interface ExpectedOutcome {
  scenario: string;
  verification: VerificationResult;
  recommendation: Recommendation;
  note: string;
}

export type HashKind =
  | "rules"
  | "expense"
  | "evidence"
  | "transfer"
  | "report";

export interface HashAnchor {
  id: string;
  campaignId: string;
  kind: HashKind;
  refId: string;
  sha256: string;
  // Simulated on-chain reference (or a real tx hash if a chain is wired):
  txRef: string;
  onChain: boolean;
  createdAt: string;
}

export interface GoogleConnection {
  email?: string;
  accessToken: string;
  refreshToken: string;
  expiry: number; // epoch ms when the access token expires
  rootFolderId?: string;
  folders?: Record<string, string>; // "Invoices" -> folderId, etc.
  connectedAt: string;
}

export interface Database {
  campaigns: Campaign[];
  rules: Rule[];
  funds: Fund[];
  expenses: Expense[];
  anchors: HashAnchor[];
  google?: GoogleConnection | null;
}
