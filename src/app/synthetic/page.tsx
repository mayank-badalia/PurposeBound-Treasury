import { listCampaigns } from "@/lib/store";
import { SCENARIO_META } from "@/lib/synthetic";
import SyntheticPanel from "@/components/SyntheticPanel";
import { ResetButton } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default async function SyntheticPage() {
  const campaigns = await listCampaigns();
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Synthetic Data Engine</h1>
          <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 6 }}>
            Deterministic fixtures for the whole verified chain. All records are clearly labelled synthetic —
            no real people, credentials or confidential data.
          </p>
        </div>
        <ResetButton />
      </div>

      <div className="card" style={{ padding: 18, margin: "18px 0" }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>The 6 scenarios</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          {SCENARIO_META.map((s, i) => (
            <div key={s.key} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{i + 1}. {s.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{s.purpose}</div>
            </div>
          ))}
        </div>
      </div>

      <SyntheticPanel campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, synthetic: c.synthetic }))} />
    </div>
  );
}
