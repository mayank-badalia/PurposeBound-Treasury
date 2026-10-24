// Feature 1: Purpose Rule Builder.
// Gemma reads the funding agreement / proposal / budget and converts it into
// clear, machine-enforceable spending rules. Deterministic fallback parses the
// same intent from the text using patterns, so it works with no API key.

import { shortId } from "./hash";
import { callGemma, tryParseJson, withGemma, type GemmaMode } from "./gemma";
import type { Rule, RuleKind } from "./types";

interface DraftRule {
  kind: RuleKind;
  label: string;
  category?: string;
  pct?: number;
  amount?: number;
}

const GEMMA_PROMPT = (doc: string) => `You are a treasury compliance analyst. Read the funding document below and extract enforceable spending rules.
Return ONLY a JSON array. Each item: {"kind": one of ["min_category_pct","max_category_amount","requires_invoice","refund_unused","manual_approval_above","forbidden_category"], "label": short human sentence, "category": optional string, "pct": optional number 0-100, "amount": optional number in INR}.
Document:
"""
${doc}
"""`;

// Deterministic extraction — pattern-matches common funding-agreement clauses.
function fallbackExtract(doc: string): DraftRule[] {
  const text = doc.toLowerCase();
  const rules: DraftRule[] = [];
  const num = (s: string) => Number(s.replace(/[,₹\s]/g, ""));

  // "at least 40% ... prizes"
  const pctRe = /(?:at least|minimum of|min\.?)\s*(\d{1,3})\s*%[^.]*?(prize|winner|award|scholarship|beneficiar\w+|relief|student)/g;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(text))) {
    const cat = m[2].startsWith("prize") || m[2].startsWith("winner") || m[2].startsWith("award")
      ? "prizes"
      : m[2];
    rules.push({
      kind: "min_category_pct",
      label: `At least ${m[1]}% must be used for ${cat}`,
      category: cat,
      pct: Number(m[1]),
    });
  }

  // "marketing expenses cannot exceed ₹20,000"
  const maxRe = /(marketing|travel|food|catering|logistics|misc\w*|overhead|administration)[^.]*?(?:not exceed|cannot exceed|no more than|max\w*|up to|capped at)\s*₹?\s*([\d,]+)/g;
  while ((m = maxRe.exec(text))) {
    rules.push({
      kind: "max_category_amount",
      label: `${cap(m[1])} expenses cannot exceed ₹${Number(num(m[2])).toLocaleString("en-IN")}`,
      category: m[1],
      amount: num(m[2]),
    });
  }

  // "vendor payments require an invoice"
  if (/invoice|bill|gst receipt|tax invoice/.test(text)) {
    rules.push({
      kind: "requires_invoice",
      label: "Vendor payments require a valid invoice",
    });
  }

  // "unused funds must be refunded"
  if (/refund|returned to (?:the )?sponsor|unused funds|unspent/.test(text)) {
    rules.push({
      kind: "refund_unused",
      label: "Unused funds must be refunded to the sponsor",
    });
  }

  // "expenses above ₹25,000 require manual approval"
  const apprRe = /(?:above|over|exceeding|greater than|more than)\s*₹?\s*([\d,]+)[^.]*?(manual|approval|authoris\w+|sign-?off)/g;
  while ((m = apprRe.exec(text))) {
    rules.push({
      kind: "manual_approval_above",
      label: `Expenses above ₹${Number(num(m[1])).toLocaleString("en-IN")} require manual approval`,
      amount: num(m[1]),
    });
  }

  // forbidden categories — catch both word orders:
  //   "<trigger> ... <category>"  and  "<category> ... <trigger>"
  const CATS = "alcohol|personal|gift\\w*|entertainment|cash withdrawal";
  const TRIG = "no|not permitted|not allowed|prohibited|forbidden|banned|not a permitted|cannot be used for";
  const seenForbidden = new Set<string>();
  const addForbidden = (catRaw: string) => {
    const cat = catRaw.toLowerCase().replace(/s$/, "");
    if (seenForbidden.has(cat)) return;
    seenForbidden.add(cat);
    rules.push({ kind: "forbidden_category", label: `${cap(catRaw)} is not a permitted expense`, category: cat });
  };
  const forbidRe = new RegExp(`(?:${TRIG})[^.]*?(${CATS})`, "g");
  while ((m = forbidRe.exec(text))) addForbidden(m[1]);
  const forbidRe2 = new RegExp(`(${CATS})[^.]*?(?:${TRIG})`, "g");
  while ((m = forbidRe2.exec(text))) addForbidden(m[1]);

  // Sensible defaults so a thin document still yields a usable ruleset.
  if (!rules.some((r) => r.kind === "requires_invoice")) {
    rules.push({ kind: "requires_invoice", label: "Vendor payments require a valid invoice" });
  }
  if (!rules.some((r) => r.kind === "manual_approval_above")) {
    rules.push({
      kind: "manual_approval_above",
      label: "Expenses above ₹25,000 require manual approval",
      amount: 25000,
    });
  }
  return rules;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function extractRules(
  campaignId: string,
  doc: string,
  opts: { llm?: boolean } = {},
): Promise<{ rules: Rule[]; source: GemmaMode }> {
  const useLlm = opts.llm !== false;
  const { value, source }: { value: DraftRule[]; source: GemmaMode } = useLlm
    ? await withGemma<DraftRule[]>(
        async () => {
          const text = await callGemma(GEMMA_PROMPT(doc), { json: true });
          const parsed = tryParseJson<DraftRule[]>(text);
          if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
            throw new Error("Gemma returned no rules");
          }
          return parsed;
        },
        () => fallbackExtract(doc),
      )
    : { value: fallbackExtract(doc), source: "fallback" };

  const rules: Rule[] = value.map((d) => ({
    id: shortId("rule"),
    campaignId,
    kind: d.kind,
    label: d.label,
    category: d.category?.toLowerCase(),
    pct: d.pct,
    amount: d.amount,
    confirmed: false,
    source,
  }));
  return { rules, source };
}
