import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/drive";

export const runtime = "nodejs";

// GET /api/auth/google/callback?code=... — finish OAuth, store tokens.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const base = process.env.APP_URL || url.origin;

  if (err) return NextResponse.redirect(`${base}/?drive=error&reason=${encodeURIComponent(err)}`);
  if (!code) return NextResponse.redirect(`${base}/?drive=error&reason=missing_code`);

  try {
    const conn = await exchangeCode(code);
    return NextResponse.redirect(`${base}/?drive=connected&email=${encodeURIComponent(conn.email || "")}`);
  } catch (e) {
    return NextResponse.redirect(`${base}/?drive=error&reason=${encodeURIComponent((e as Error).message)}`);
  }
}
