"use client";

import { useEffect, useRef, useState } from "react";
import { INTRO_SVG } from "./introSequenceSvg";

// The designer SVG is a 12s loop. We drive its SMIL timeline by hand so it
// plays ONCE and fast: traverse ~10.6s of the timeline (letter-reveal →
// fluid → settle, stopping just before the loop resets) in ~3.3s of real time.
const REAL_MS = 3300;
const SVG_SECONDS = 10.6;

/**
 * Cinematic opening sequence, built from the brand's own
 * PurposeBound_Treasury_Full_Sequence.svg (letter reveal → liquid motion →
 * hold), then a page-reveal wipe. Plays once per session, is skippable
 * (click / any key), and is bypassed under prefers-reduced-motion (handled
 * by the no-flash inline script in layout).
 */
export default function IntroOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    try {
      sessionStorage.setItem("pb_intro", "1");
    } catch {
      /* private mode — ignore */
    }
    if (root.classList.contains("intro-done")) return;

    const svg = hostRef.current?.querySelector("svg") as SVGSVGElement | null;
    try {
      svg?.pauseAnimations?.();
    } catch {
      /* SMIL not controllable — the CSS failsafe still dismisses the overlay */
    }

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
      const p = Math.min(1, (t - start) / REAL_MS);
      try {
        svg?.setCurrentTime?.(p * SVG_SECONDS);
      } catch {
        /* ignore */
      }
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);

    // Never trap the viewer under the overlay if a frame loop stalls.
    timer = window.setTimeout(finish, REAL_MS + 1200);
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
      <div className="intro-stage" ref={hostRef} dangerouslySetInnerHTML={{ __html: INTRO_SVG }} />
      <div className="intro-load">
        <span>Loading visuals</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
