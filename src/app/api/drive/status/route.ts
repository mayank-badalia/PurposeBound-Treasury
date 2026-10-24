import { NextResponse } from "next/server";
import { driveConfigured } from "@/lib/drive";
import { getGoogle } from "@/lib/store";

export const runtime = "nodejs";

// GET /api/drive/status — is Drive configured and connected?
export async function GET() {
  const conn = await getGoogle();
  return NextResponse.json({
    configured: driveConfigured(),
    connected: Boolean(conn),
    email: conn?.email ?? null,
    folders: conn?.folders ? Object.keys(conn.folders) : [],
  });
}
