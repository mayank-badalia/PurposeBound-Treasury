import { NextRequest, NextResponse } from "next/server";
import { decideExpense } from "@/lib/service";

export const runtime = "nodejs";

// Human confirms the recommendation. Approval triggers the Razorpay transfer.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const expense = await decideExpense(id, {
      decision: body.decision === "reject" ? "reject" : "approve",
      approvedAmount: Number(body.approvedAmount) || 0,
      decidedBy: body.decidedBy || "Authorised Approver",
      note: body.note || "",
    });
    return NextResponse.json({ ok: true, expense });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
