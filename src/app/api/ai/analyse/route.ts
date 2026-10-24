import { NextRequest, NextResponse } from "next/server";
import { callGemma, gemmaMode, sanitizeCurrency, tryParseJson } from "@/lib/gemma";

export const runtime = "nodejs";

// POST /api/ai/analyse — direct Gemma 4 analysis surface.
// Body: { kind?: "agreement"|"invoice"|"receipt"|"evidence", text?, imageBase64?, mimeType?, context? }
// Returns the structured decision shape:
//   { decision, purpose_match, invoice_valid, amount_requested, amount_allowed,
//     risk_score, missing_evidence[], reason, source }
interface AnalyseResult {
  decision: "approve" | "needs_review" | "reject";
  purpose_match: boolean;
  invoice_valid: boolean;
  amount_requested: number | null;
  amount_allowed: number | null;
  risk_score: number;
  missing_evidence: string[];
  reason: string;
}

const PROMPT = (kind: string, text: string, context: string) =>
  `You are the compliance analyst for a purpose-bound treasury. Analyse the ${kind}.
${context ? `Context / funding rules:\n${context}\n` : ""}${text ? `Content:\n"""${text}"""\n` : ""}
Return ONLY JSON with exactly these keys:
{"decision": "approve" | "needs_review" | "reject",
 "purpose_match": boolean,
 "invoice_valid": boolean,
 "amount_requested": number | null,
 "amount_allowed": number | null,
 "risk_score": number (0-100),
 "missing_evidence": string[],
 "reason": string}`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "evidence");
  const text = String(body.text || "");
  const context = String(body.context || "");
  const imageBase64 = body.imageBase64 as string | undefined;
  const mimeType = String(body.mimeType || "image/jpeg");

  if (!text && !imageBase64) {
    return NextResponse.json({ ok: false, error: "Provide text or imageBase64" }, { status: 400 });
  }

  if (gemmaMode() === "gemma") {
    try {
      const raw = await callGemma(PROMPT(kind, text, context), {
        image: imageBase64 ? { mimeType, base64: imageBase64 } : undefined,
        json: true,
      });
      const parsed = tryParseJson<AnalyseResult>(raw);
      if (parsed) {
        if (parsed.reason) parsed.reason = sanitizeCurrency(parsed.reason);
        return NextResponse.json({ ok: true, source: "gemma", model: process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it", result: parsed });
      }
      return NextResponse.json({ ok: true, source: "gemma", raw });
    } catch (err) {
      return NextResponse.json({ ok: false, source: "gemma", error: (err as Error).message }, { status: 502 });
    }
  }

  // Deterministic fallback (no key configured).
  const fallback: AnalyseResult = {
    decision: "needs_review",
    purpose_match: true,
    invoice_valid: Boolean(imageBase64 || /invoice|receipt|bill/i.test(text)),
    amount_requested: null,
    amount_allowed: null,
    risk_score: 30,
    missing_evidence: imageBase64 ? [] : ["supporting document or photo"],
    reason: "Offline fallback — no Gemma key configured; returning a conservative review verdict.",
  };
  return NextResponse.json({ ok: true, source: "fallback", result: fallback });
}
