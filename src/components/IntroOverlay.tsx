"use client";

import { useEffect, useRef, useState } from "react";

const WORD = "PurposeBound";

/**
 * Cinematic opening sequence (scenes 1–4 from the motion spec):
 *   1. Letter reveal   — the blackletter wordmark assembles, letter by letter
 *   2. Fluid motion    — liquid-pink light sweeps in behind it
 *   3. Hold            — the mark settles, "Treasury" tracks out below
 *   4. Page reveal     — the whole sheet lifts away, uncovering the app
 *
 * Pure CSS/DOM, no WebGL and no new dependencies. Plays once per session,
 * is skippable (click or any key), and is bypassed entirely under
 * prefers-reduced-motion (handled by the no-flash inline script in layout).
 */
export default function IntroOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    // Remember for the rest of the session so a reload doesn't replay it.
    try {
      sessionStorage.setItem("pb_intro", "1");
    } catch {
      /* private mode — ignore */
    }

    // Already handled before paint (seen this session, or reduced motion).
    if (root.classList.contains("intro-done")) return;

    let raf = 0;
    let timer = 0;
    const finish = () => {
      root.classList.add("intro-done");
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    const onKey = () => finish();

    // Loading counter 0 → 100 over the first ~2s.
    const start = performance.now();
    const DUR = 2000;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DUR);
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Auto-advance to the page reveal.
    timer = window.setTimeout(finish, 2850);
    window.addEventListener("keydown", onKey, { once: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className="intro" aria-hidden="true" onClick={() => document.documentElement.classList.add("intro-done")}>
      <div className="intro-fluid" />
      <div className="intro-inner">
        <div className="intro-word black-letter">
          {WORD.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.055 * i}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="intro-sub">Treasury</div>
      </div>
      <div className="intro-load">
        <span>Loading visuals</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
