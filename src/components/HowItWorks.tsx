/**
 * Editorial "how it works" strip (storyboard scene 02), shown on the dashboard
 * under the hero. Pure presentation — CSS 3D marble blocks revealed on scroll.
 * No data, routes or buttons. Copy is taken from the storyboard.
 */

const BLOCKS = [
  { n: "01", kicker: "Agreement", word: "PROMISE", body: "A signed MOU sets the intent, scope and commitments." },
  { n: "02", kicker: "Treasury rules", word: "RULES", body: "Key terms are extracted and turned into enforceable rules." },
  { n: "03", kicker: "Real-world impact", word: "PROOF", body: "Disbursements, reports and outcomes — all verifiable." },
];

export default function HowItWorks() {
  return (
    <section style={{ marginTop: 54, marginBottom: 44 }}>
      <div
        className="reveal"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 26 }}
      >
        <div>
          <div className="eyebrow">Agreements become real-world impact</div>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginTop: 8 }}>From paper to performance.</h2>
        </div>
        <p style={{ color: "var(--body)", maxWidth: 330, fontSize: 14.5, lineHeight: 1.6 }}>
          Every signed agreement becomes enforceable treasury rules — so each rupee stays traceable,
          compliant, and used for exactly what it was promised.
        </p>
      </div>

      <div className="slabs">
        {BLOCKS.map((b, i) => (
          <div key={b.word} className={`slab reveal reveal-${i + 1}`}>
            <div className="slab-inner">
              <div className="slab-kicker"><span>{b.n}</span> — {b.kicker}</div>
              <div className="slab-word">{b.word}</div>
              <div className="slab-body">{b.body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
