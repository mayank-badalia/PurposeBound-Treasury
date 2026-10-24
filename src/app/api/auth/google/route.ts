import { NextResponse } from "next/server";
import { authUrl, driveConfigured } from "@/lib/drive";

export const runtime = "nodejs";

// GET /api/auth/google — start the OAuth consent flow.
export async function GET() {
  if (!driveConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Google Drive is not configured (missing client id/secret/redirect)." },
      { status: 400 },
    );
  }
  return NextResponse.redirect(authUrl());
}
