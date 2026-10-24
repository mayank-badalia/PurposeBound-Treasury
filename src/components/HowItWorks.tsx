import type { CSSProperties } from "react";

/**
 * Editorial "how it works" narrative (storyboard scenes 02–03), shown on the
 * dashboard under the hero. Pure presentation — CSS 3D blocks + a receding
 * perspective floor, revealed on scroll via the layout's observer. No data,
 * routes or buttons. Copy is taken from the storyboard.
 */

const BLOCKS = [
  { n: "01", kicker: "Agreement", word: "PROMISE", body: "A signed MOU sets the intent, scope and commitments." },
  { n: "02", kicker: "Treasury rules", word: "RULES", body: "Key terms are extracted and turned into enforceable rules." },
  { n: "03", kicker: "Real-world impact", word: "PROOF", body: "Disbursements, reports and outcomes — all verifiable." },
];

const STEPS = [
  { n: "01", word: "AGREEMENT", body: "Start with a signed MOU or contract." },
  { n: "02", word: "EVIDENCE", body: "Track milestones and supporting documents." },
  { n: "03", word: "APPROVAL", body: "Confirm against the treasury rules." },
  { n: "04", word: "PAYMENT", body: "Disburse with full traceability." },
];

export default function HowItWorks() {
  return (
    <>
      {/* Scene 02 — PROMISE · RULES · PROOF, carved into marble blocks */}
      <section style={{ marginTop: 46 }}>
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

      {/* Scene 03 — four checks, one accountable decision */}
      <section style={{ marginTop: 60 }}>
        <div className="reveal" style={{ marginBottom: 20 }}>
          <div className="eyebrow">Four checks, one accountable decision</div>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginTop: 8, maxWidth: 760 }}>
            From agreement to payment, every step is verified.
          </h2>
        </div>

        <div className="stage3d reveal" aria-hidden="true">
          <div className="stage3d-floor">
            {STEPS.map((s, i) => (
              <div key={s.word} className="floorword" style={{ "--i": i } as CSSProperties}>{s.word}</div>
            ))}
          </div>
        </div>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.word} className={`step reveal reveal-${i + 1}`}>
              <div className="step-n">{s.n}</div>
              <div className="step-word">{s.word}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
