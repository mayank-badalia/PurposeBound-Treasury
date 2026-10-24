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
    <nav className="site-nav">
      {NAV.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
