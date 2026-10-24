import { NextResponse } from "next/server";
import { reviewExpense } from "@/lib/service";

export const runtime = "nodejs";

// Run the 4-agent pipeline on an expense.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const expense = await reviewExpense(id);
    return NextResponse.json({ ok: true, expense });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
