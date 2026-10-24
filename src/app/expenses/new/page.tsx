import { listCampaigns } from "@/lib/store";
import ExpenseForm from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const campaigns = await listCampaigns();
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Vendor payment request</div>
      <h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>Create a payment request.</h1>
      <p style={{ color: "var(--body)", maxWidth: 680, marginTop: 12, marginBottom: 30, fontSize: 15.5, lineHeight: 1.6 }}>
        Upload the invoice, receipt or a photo of completion. Gemma reads the evidence, the agents check it
        against the funding rules and the live budget, and a human confirms before any transfer.
      </p>
      <ExpenseForm campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
