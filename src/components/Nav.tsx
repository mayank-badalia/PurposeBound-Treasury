"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/rules", label: "Rule Builder" },
  { href: "/expenses/new", label: "Submit Expense" },
  { href: "/approvals", label: "Approvals" },
  { href: "/synthetic", label: "Synthetic Data" },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
      {NAV.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            style={{
              fontSize: 14.5,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--brand)" : "var(--body)",
              paddingBottom: 3,
              borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
              transition: "color 0.18s ease, border-color 0.18s ease",
            }}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
