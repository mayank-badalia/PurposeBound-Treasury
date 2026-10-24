// Gemma provider.
//
// Gemma is the multimodal brain: it reads funding agreements into rules, reads
// invoices/receipts/photos into structured facts, and writes plain-language
// explanations. If a GEMMA_API_KEY is configured we call the Google Generative
// Language API (Gemma model). Otherwise we fall back to deterministic,
// clearly-labelled logic so the demo always runs offline.
//
// IMPORTANT: Gemma never does the budget arithmetic — see lib/budget.ts. The
// LLM explains numbers; code computes them.

export type GemmaMode = "gemma" | "fallback";

// Accept either env name (GEMINI_API_KEY is Google AI Studio's convention).
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY;
}

export function gemmaMode(): GemmaMode {
  return apiKey() ? "gemma" : "fallback";
}

const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

// Low-level call to the Google Generative Language REST API. Returns raw text
// or throws. Only reached when GEMMA_API_KEY is set.
export async function callGemma(
  prompt: string,
  opts: { image?: { mimeType: string; base64: string }; json?: boolean } = {},
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("GEMINI_API_KEY / GEMMA_API_KEY not set");

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (opts.image) {
    parts.push({
      inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: opts.json
      ? { responseMimeType: "application/json", temperature: 0.2 }
      : { temperature: 0.4 },
  });

  // Retry transient Google-side errors (500/503) and rate limits (429).
  let res!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    if (res.ok) break;
    if (![500, 502, 503, 429].includes(res.status) || attempt === 2) {
      throw new Error(`Gemma API ${res.status}: ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  // gemma-4 is a reasoning model: it returns hidden "thought" parts alongside
  // the answer. Keep only the real answer parts, never the chain-of-thought.
  const respParts = data.candidates?.[0]?.content?.parts ?? [];
  const answer = respParts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  return answer || respParts.map((p) => p.text ?? "").join("").trim();
}

// Safe wrapper: try Gemma, fall back to a deterministic value on any failure.
export async function withGemma<T>(
  run: () => Promise<T>,
  fallback: () => T,
): Promise<{ value: T; source: GemmaMode }> {
  if (gemmaMode() === "gemma") {
    try {
      return { value: await run(), source: "gemma" };
    } catch (err) {
      console.warn("[gemma] fell back to deterministic:", (err as Error).message);
    }
  }
  return { value: fallback(), source: "fallback" };
}

// Defensive currency sanitiser: LLMs often render INR amounts with a "$". All
// money in this app is Indian Rupees, so force ₹ and fix dollar/USD wording.
export function sanitizeCurrency(s: string): string {
  return s
    .replace(/(?:US)?\$\s?(?=\d)/g, "₹")
    .replace(/\bUSD\b/g, "INR")
    .replace(/\bdollars?\b/gi, "rupees");
}

export function tryParseJson<T>(text: string): T | null {
  try {
    const start = text.indexOf("{");
    const arrStart = text.indexOf("[");
    const s =
      arrStart >= 0 && (arrStart < start || start < 0) ? arrStart : start;
    if (s < 0) return null;
    return JSON.parse(text.slice(s, text.lastIndexOf(s === arrStart ? "]" : "}") + 1)) as T;
  } catch {
    return null;
  }
}
