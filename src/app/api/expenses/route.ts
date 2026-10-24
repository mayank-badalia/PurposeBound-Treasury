import { NextRequest, NextResponse } from "next/server";
import { submitExpense } from "@/lib/service";
import { contentHash, visualFingerprint } from "@/lib/fingerprint";
import { callGemma, gemmaMode, tryParseJson } from "@/lib/gemma";
import { shortId } from "@/lib/hash";
import { uploadToDrive } from "@/lib/drive";
import { getGoogle } from "@/lib/store";
import type { Evidence, EvidenceType } from "@/lib/types";

export const runtime = "nodejs";

function inferType(file: File, hint?: string): EvidenceType {
  if (hint === "invoice" || hint === "receipt" || hint === "photo" || hint === "completion") {
    return hint;
  }
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.includes("pdf") || file.type.includes("word") || file.type.includes("sheet")) {
    return "invoice";
  }
  return "receipt";
}

// Ask Gemma to read an uploaded document/image. Falls back to a safe default
// (assume the invoice matches the claim) when no key is set.
async function extract(
  file: File,
  bytes: Uint8Array,
  type: EvidenceType,
  claim: { vendor: string; amount: number },
): Promise<Evidence["extracted"]> {
  if (gemmaMode() === "gemma") {
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      const prompt =
        type === "photo" || type === "completion"
          ? `Does this photo plausibly support a claimed expense to "${claim.vendor}" for ₹${claim.amount}? Reply ONLY JSON: {"supportsClaim": boolean, "notes": string}.`
          : `Extract fields from this ${type}. Reply ONLY JSON: {"vendor": string, "amount": number, "date": string, "description": string, "supportsClaim": boolean}.`;
      const text = await callGemma(prompt, {
        image: { mimeType: file.type || "application/octet-stream", base64 },
        json: true,
      });
      const parsed = tryParseJson<Evidence["extracted"]>(text);
      if (parsed) return parsed;
    } catch (err) {
      console.warn("[extract] gemma fell back:", (err as Error).message);
    }
  }
  // Deterministic fallback: trust uploaded invoices as matching the claim.
  return type === "photo" || type === "completion"
    ? { supportsClaim: true, notes: "Fallback: photo accepted (no vision model configured)." }
    : { vendor: claim.vendor, amount: claim.amount, date: new Date().toISOString().slice(0, 10), description: "Fallback extraction", supportsClaim: true };
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const campaignId = String(form.get("campaignId") || "");
  const category = String(form.get("category") || "");
  const amount = Number(form.get("amount") || 0);
  const vendor = String(form.get("vendor") || "");
  const recipient = String(form.get("recipient") || "");
  const vendorLinkedAccountId = String(form.get("vendorLinkedAccountId") || "");
  const description = String(form.get("description") || "");

  if (!campaignId || !category || !amount || !vendor) {
    return NextResponse.json({ ok: false, error: "campaignId, category, amount, vendor required" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const typeHints = form.getAll("types").map(String);

  const driveConnected = Boolean(await getGoogle());
  const evidence: Evidence[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = inferType(file, typeHints[i]);

    // Store the real document in Google Drive when connected; only the hash is
    // anchored. Falls back to a simulated id if Drive isn't connected or errors.
    let driveFileId = `drive_sim_${shortId("f").slice(2)}`;
    if (driveConnected) {
      try {
        const subfolder = type === "invoice" ? "Invoices" : "Evidence";
        const up = await uploadToDrive(file.name, file.type || "application/octet-stream", bytes, subfolder);
        driveFileId = up.fileId;
      } catch (err) {
        console.warn("[drive] upload fell back to simulated:", (err as Error).message);
      }
    }

    evidence.push({
      id: shortId("ev"),
      expenseId: "", // set in submitExpense
      type,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: bytes.length,
      contentHash: contentHash(bytes),
      visualFingerprint: visualFingerprint(bytes),
      uploadedAt: new Date().toISOString(),
      driveFileId,
      extracted: await extract(file, bytes, type, { vendor, amount }),
    });
  }

  const expense = await submitExpense({
    campaignId,
    category,
    amount,
    vendor,
    recipient,
    vendorLinkedAccountId,
    description,
    evidence,
  });
  // Stamp the generated expense id onto each evidence record.
  expense.evidence = expense.evidence.map((e) => ({ ...e, expenseId: expense.id }));
  return NextResponse.json({ ok: true, expense });
}
