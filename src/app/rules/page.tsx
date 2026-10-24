import RuleBuilder from "@/components/RuleBuilder";

export const dynamic = "force-dynamic";

export default function RulesPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Purpose Rule Builder</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 6, marginBottom: 18 }}>
        Gemma reads a funding agreement and converts it into clear, enforceable spending rules. The organiser
        reviews and confirms them before any funds are accepted — and the confirmed set is hash-anchored.
      </p>
      <RuleBuilder />
    </div>
  );
}
