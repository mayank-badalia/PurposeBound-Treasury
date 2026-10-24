import { NextRequest, NextResponse } from "next/server";
import { callGemma, gemmaMode } from "@/lib/gemma";
import { uploadToDrive } from "@/lib/drive";
import { getGoogle } from "@/lib/store";

export const runtime = "nodejs";

// POST /api/mou/read  (multipart form: file)
// Gemma reads/transcribes an uploaded MOU (image or PDF) to plain text so the
// Rule Builder can extract rules from it. The original is stored in Google
// Drive (Agreements folder) when connected; only its text comes back here.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // Transcribe with Gemma (multimodal). Fallback asks the user to paste text.
  let text = "";
  let source: "gemma" | "fallback" = "fallback";
  if (gemmaMode() === "gemma") {
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      const out = await callGemma(
        "Transcribe this agreement/MOU document to plain text. Preserve every clause, number and amount exactly. Output ONLY the transcribed text, no commentary.",
        { image: { mimeType, base64 } },
      );
      if (out.trim()) {
        text = out.trim();
        source = "gemma";
      }
    } catch (err) {
      console.warn("[mou] gemma read failed:", (err as Error).message);
    }
  }

  // Store the original in Drive (best-effort).
  let driveFileId: string | undefined;
  let driveLink: string | undefined;
  if (await getGoogle()) {
    try {
      const up = await uploadToDrive(file.name, mimeType, bytes, "Agreements");
      driveFileId = up.fileId;
      driveLink = up.webViewLink;
    } catch (err) {
      console.warn("[mou] drive upload failed:", (err as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    source,
    text,
    filename: file.name,
    driveFileId,
    driveLink,
  });
}
