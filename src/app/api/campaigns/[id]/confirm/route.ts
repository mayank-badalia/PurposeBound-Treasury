import { NextRequest, NextResponse } from "next/server";
import { anchor, getCampaign, replaceRules, upsertCampaign } from "@/lib/store";
import type { Rule } from "@/lib/types";

export const runtime = "nodejs";

// Organiser confirms (and optionally edits) the rules, which locks the campaign
// and anchors the approved ruleset.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rules = (body.rules as Rule[]).map((r) => ({ ...r, campaignId: id, confirmed: true }));
  await replaceRules(id, rules);

  campaign.rulesLocked = true;
  campaign.status = "active";
  await upsertCampaign(campaign);

  const a = await anchor(id, "rules", id, JSON.stringify(rules.map((r) => r.label)));
  return NextResponse.json({ ok: true, anchor: a });
}
