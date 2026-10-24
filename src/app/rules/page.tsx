import RuleBuilder from "@/components/RuleBuilder";

export const dynamic = "force-dynamic";

export default function RulesPage() {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>From agreements to action</div>
      <h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>Turn the MOU into enforceable rules.</h1>
      <p style={{ color: "var(--body)", maxWidth: 680, marginTop: 12, marginBottom: 30, fontSize: 15.5, lineHeight: 1.6 }}>
        Gemma reads a funding agreement and converts it into clear, enforceable spending rules. The organiser
        reviews and confirms them before any funds are accepted — and the confirmed set is hash-anchored.
      </p>
      <RuleBuilder />
    </div>
  );
}
