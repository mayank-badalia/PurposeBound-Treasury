import { NextRequest, NextResponse } from "next/server";
import { resetDb } from "@/lib/store";
import { seedFixedDataset, seedGenerated } from "@/lib/service";
import { validateCampaign } from "@/lib/validate";
import { buildFixedDataset, generateDataset, SCENARIO_META } from "@/lib/synthetic";

export const runtime = "nodejs";

// POST actions for the Synthetic Data panel.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  switch (action) {
    case "reset_and_seed_fixed": {
      await resetDb();
      const id = await seedFixedDataset();
      return NextResponse.json({ ok: true, campaignId: id });
    }
    case "seed_fixed": {
      const id = await seedFixedDataset();
      return NextResponse.json({ ok: true, campaignId: id });
    }
    case "generate": {
      const id = await seedGenerated({
        seed: body.seed,
        size: body.size,
        scenarioTypes: body.scenarioTypes,
      });
      return NextResponse.json({ ok: true, campaignId: id });
    }
    case "validate": {
      const summary = await validateCampaign(body.campaignId);
      return NextResponse.json({ ok: true, summary });
    }
    case "reset": {
      await resetDb();
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }
}

// GET: metadata about available scenarios, or download a dataset as JSON.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const download = url.searchParams.get("download");
  if (download === "fixed") {
    const ds = buildFixedDataset();
    return new NextResponse(JSON.stringify(ds, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="synthetic-fixed-dataset.json"',
      },
    });
  }
  if (download === "generated") {
    const ds = generateDataset({
      seed: url.searchParams.get("seed") ?? undefined,
      size: Number(url.searchParams.get("size") ?? 12),
    });
    return new NextResponse(JSON.stringify(ds, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="synthetic-generated-dataset.json"',
      },
    });
  }
  return NextResponse.json({ scenarios: SCENARIO_META });
}
