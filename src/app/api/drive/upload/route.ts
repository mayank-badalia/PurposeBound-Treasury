import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive } from "@/lib/drive";
import { getGoogle } from "@/lib/store";

export const runtime = "nodejs";

// POST /api/drive/upload  (multipart form: file, subfolder?)
// Uploads a document to the campaign's Drive folder and returns the file id.
export async function POST(req: NextRequest) {
  if (!(await getGoogle())) {
    return NextResponse.json({ ok: false, error: "Google Drive not connected" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
  }
  const subfolder = String(form.get("subfolder") || "Evidence");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const up = await uploadToDrive(file.name, file.type || "application/octet-stream", bytes, subfolder);
    return NextResponse.json({ ok: true, ...up });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
