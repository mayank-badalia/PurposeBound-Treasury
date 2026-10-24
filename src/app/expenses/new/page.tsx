import { listCampaigns } from "@/lib/store";
import ExpenseForm from "@/components/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const campaigns = await listCampaigns();
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Submit an Expense</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 6, marginBottom: 18 }}>
        Upload the invoice, receipt or a photo of completion. Gemma reads the evidence, the agents check it
        against the funding rules and the live budget, and a human confirms before any transfer.
      </p>
      <ExpenseForm campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
