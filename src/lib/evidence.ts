// Feature 2: AI Evidence & Expense Verifier.
//
// Gemma reads the uploaded invoice / receipt / photo and checks whether the
// evidence supports the claimed expense. Deterministic fallback uses the
// structured fields already attached to each Evidence record (synthetic
// fixtures carry them; real uploads get them from Gemma when a key is set),
// plus exact/near duplicate detection via fingerprints.

import {
  fingerprintDistance,
  NEAR_DUPLICATE_THRESHOLD,
} from "./fingerprint";
import type { Evidence, Expense, Rule, VerificationResult } from "./types";

export interface DuplicateHit {
  evidenceId: string;
  otherEvidenceId: string;
  kind: "exact" | "near";
  distance: number;
}

export interface EvidenceAnalysis {
  verification: VerificationResult;
  details: string[];
  duplicates: DuplicateHit[];
  amountMatches: boolean;
  hasRequiredInvoice: boolean;
  photoSupportsClaim: boolean | null;
}

export function analyzeEvidence(
  expense: Expense,
  rules: Rule[],
  priorEvidence: Evidence[], // evidence from OTHER expenses in the campaign
): EvidenceAnalysis {
  const details: string[] = [];
  const own = expense.evidence;

  const requiresInvoice = rules.some((r) => r.kind === "requires_invoice");
  const hasInvoice = own.some((e) => e.type === "invoice");
  const hasRequiredInvoice = !requiresInvoice || hasInvoice;
  if (requiresInvoice) {
    details.push(
      hasInvoice
        ? "Required invoice is attached."
        : "Required invoice is missing for this vendor payment.",
    );
  }

  // Duplicate detection against the rest of the campaign.
  const duplicates: DuplicateHit[] = [];
  for (const e of own) {
    for (const p of priorEvidence) {
      if (p.expenseId === expense.id) continue;
      // Only an EARLIER submission counts as the thing being duplicated, so the
      // original is never flagged by its own later copy.
      if (p.uploadedAt >= e.uploadedAt) continue;
      if (p.contentHash === e.contentHash) {
        duplicates.push({ evidenceId: e.id, otherEvidenceId: p.id, kind: "exact", distance: 0 });
        continue;
      }
      const d = fingerprintDistance(e.visualFingerprint, p.visualFingerprint);
      if (d <= NEAR_DUPLICATE_THRESHOLD) {
        duplicates.push({ evidenceId: e.id, otherEvidenceId: p.id, kind: "near", distance: d });
      }
    }
  }
  if (duplicates.length) {
    details.push(
      `Duplicate evidence detected (${duplicates[0].kind}) — this receipt appears to have been submitted before.`,
    );
  }

  // Amount consistency: does the extracted invoice amount match the claim?
  const invoice = own.find((e) => e.type === "invoice") ?? own[0];
  let amountMatches = true;
  if (invoice?.extracted?.amount != null) {
    const diff = Math.abs(invoice.extracted.amount - expense.amount);
    amountMatches = diff <= Math.max(1, expense.amount * 0.02); // 2% tolerance
    details.push(
      amountMatches
        ? `Invoice amount ₹${invoice.extracted.amount.toLocaleString("en-IN")} matches the claim.`
        : `Invoice amount ₹${invoice.extracted.amount.toLocaleString("en-IN")} does not match the ₹${expense.amount.toLocaleString("en-IN")} claim.`,
    );
  }

  // Vendor consistency.
  if (invoice?.extracted?.vendor) {
    const consistent =
      invoice.extracted.vendor.trim().toLowerCase() === expense.vendor.trim().toLowerCase();
    if (!consistent) {
      details.push(
        `Invoice vendor "${invoice.extracted.vendor}" differs from the claimed vendor "${expense.vendor}".`,
      );
    }
  }

  // Do the photos support the claim?
  const photos = own.filter((e) => e.type === "photo" || e.type === "completion");
  let photoSupportsClaim: boolean | null = null;
  if (photos.length) {
    photoSupportsClaim = photos.every((p) => p.extracted?.supportsClaim !== false);
    details.push(
      photoSupportsClaim
        ? "Uploaded photographs support the claim."
        : "Uploaded photographs do not clearly support the claim.",
    );
  }

  // Decide the single verification result.
  let verification: VerificationResult = "verified";
  if (!hasRequiredInvoice || own.length === 0) {
    verification = "missing_evidence";
  } else if (duplicates.length || !amountMatches || photoSupportsClaim === false) {
    verification = "suspicious";
  }

  return {
    verification,
    details,
    duplicates,
    amountMatches,
    hasRequiredInvoice,
    photoSupportsClaim,
  };
}
