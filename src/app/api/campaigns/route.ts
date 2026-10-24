import { NextRequest, NextResponse } from "next/server";
import { extractRules } from "@/lib/rules";
import { listCampaigns, upsertCampaign } from "@/lib/store";
import { shortId } from "@/lib/hash";
import type { Campaign } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ campaigns: await listCampaigns() });
}

// Create a draft campaign and run the Purpose Rule Builder on its document.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, organiser, description, sourceDocument } = body as Record<string, string>;
  if (!name || !sourceDocument) {
    return NextResponse.json({ ok: false, error: "name and sourceDocument required" }, { status: 400 });
  }

  // Re-use an existing campaign with the same name instead of creating a
  // duplicate — so re-running the Rule Builder keeps funds + expenses attached
  // to ONE campaign (no more "funded one, spent on another empty one").
  const existing = (await listCampaigns()).find(
    (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const campaign: Campaign = existing
    ? { ...existing, organiser: organiser || existing.organiser, description: description || existing.description, sourceDocument }
    : {
        id: shortId("camp"),
        name,
        organiser: organiser || "Organiser",
        description: description || "",
        sourceDocument,
        status: "draft",
        rulesLocked: false,
        createdAt: new Date().toISOString(),
        synthetic: false,
      };
  await upsertCampaign(campaign);
  const { rules, source } = await extractRules(campaign.id, sourceDocument);
  return NextResponse.json({ ok: true, campaign, draftRules: rules, source });
}
