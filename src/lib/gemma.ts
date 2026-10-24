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

export function gemmaMode(): GemmaMode {
  return process.env.GEMMA_API_KEY ? "gemma" : "fallback";
}

const MODEL = process.env.GEMMA_MODEL || "gemma-3-27b-it";

// Low-level call to the Google Generative Language REST API. Returns raw text
// or throws. Only reached when GEMMA_API_KEY is set.
export async function callGemma(
  prompt: string,
  opts: { image?: { mimeType: string; base64: string }; json?: boolean } = {},
): Promise<string> {
  const key = process.env.GEMMA_API_KEY;
  if (!key) throw new Error("GEMMA_API_KEY not set");

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (opts.image) {
    parts.push({
      inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: opts.json
        ? { responseMimeType: "application/json", temperature: 0.2 }
        : { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemma API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
