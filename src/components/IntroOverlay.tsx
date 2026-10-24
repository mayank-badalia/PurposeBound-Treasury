"use client";

import { useEffect, useState } from "react";
import { INTRO_SVG } from "./introSequenceSvg";

// The SVG's SMIL timeline is baked to 3.4s and plays natively on inject. We let
// it run (letter reveal → fluid → hold), then wipe the overlay away at ~3.0s —
// before the loop would reset — so the wordmark is still on screen as it lifts.
const LOAD_MS = 2700;
const WIPE_MS = 3000;

/**
 * Cinematic opening sequence from the brand's own
 * PurposeBound_Treasury_Full_Sequence.svg, then a page-reveal wipe. Plays on
 * every full page load (never on in-app navigation — the layout doesn't
 * remount), is skippable (click / any key), and is bypassed under
 * prefers-reduced-motion (handled by the no-flash inline script in layout).
 */
export default function IntroOverlay() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("intro-done")) return;

    let raf = 0;
    let timer = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.classList.add("intro-done");
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
    const onKey = () => finish();

    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / LOAD_MS);
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    timer = window.setTimeout(finish, WIPE_MS);
    window.addEventListener("keydown", onKey, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="intro"
      aria-hidden="true"
      onClick={() => document.documentElement.classList.add("intro-done")}
    >
      <div className="intro-fluid" />
      <div className="intro-stage" dangerouslySetInnerHTML={{ __html: INTRO_SVG }} />
      <div className="intro-load">
        <span>Loading visuals</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
