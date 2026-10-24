"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-driven reveals for anything tagged `.reveal`.
 *
 * Content is only hidden once this component has attached (it adds
 * `js-reveal` to <html>, and the hiding CSS is scoped under that class),
 * so if JS never runs the content stays fully visible — no blank sections.
 * Re-scans on every route change because App Router swaps page content
 * client-side after this layout-level effect has already run.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-reveal");

    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)")
    );
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));

    // Safety net: never leave anything hidden, even if the observer misses it.
    const failsafe = window.setTimeout(() => {
      els.forEach((el) => el.classList.add("in"));
    }, 4000);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
