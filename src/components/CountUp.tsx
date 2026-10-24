"use client";

import { useEffect, useState } from "react";
import { inr } from "@/lib/format";

// Counts a rupee value up to its real final number over ~700ms on mount.
// Respects reduced motion and never changes the final displayed value.
export default function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{inr(n)}</>;
}
