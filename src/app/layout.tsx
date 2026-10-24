import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { gemmaMode } from "@/lib/gemma";
import { razorpayMode } from "@/lib/razorpay";
import { chainConfigured } from "@/lib/hash";
import { driveConfigured } from "@/lib/drive";
import { getGoogle } from "@/lib/store";

export const metadata: Metadata = {
  title: "PurposeBound Treasury",
  description: "Every rupee connected to its promised purpose.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/rules", label: "Rule Builder" },
  { href: "/expenses/new", label: "Submit Expense" },
  { href: "/approvals", label: "Approvals" },
  { href: "/synthetic", label: "Synthetic Data" },
];

function ModeBadge({ label, mode, live }: { label: string; mode: string; live: boolean }) {
  return (
    <span className="chip" title={`${label}: ${mode}`}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: live ? "var(--ok)" : "var(--warn)",
          display: "inline-block",
        }}
      />
      {label}: <span style={{ color: live ? "var(--ok)" : "var(--warn)" }}>{mode}</span>
    </span>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gemma = gemmaMode();
  const rzp = razorpayMode();
  const chain = chainConfigured();
  const driveConn = await getGoogle();
  const driveReady = driveConfigured();
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(10,15,30,0.7)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                <span
                  style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
                    display: "grid", placeItems: "center", color: "#042016", fontWeight: 800,
                  }}
                >
                  ₹
                </span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>
                  PurposeBound <span style={{ color: "var(--brand)" }}>Treasury</span>
                </span>
              </Link>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ModeBadge label="Gemma" mode={gemma === "gemma" ? "live API" : "offline fallback"} live={gemma === "gemma"} />
                <ModeBadge label="Razorpay" mode={rzp === "sandbox" ? "sandbox" : "mock"} live={rzp === "sandbox"} />
                <ModeBadge label="Chain" mode={chain ? "on-chain" : "simulated"} live={chain} />
                {driveConn ? (
                  <ModeBadge label="Drive" mode={driveConn.email ? "connected" : "connected"} live={true} />
                ) : driveReady ? (
                  <a className="chip" href="/api/auth/google" style={{ color: "var(--brand-2)", borderColor: "var(--brand-2)" }}>
                    Connect Google Drive
                  </a>
                ) : (
                  <ModeBadge label="Drive" mode="not set" live={false} />
                )}
              </div>
            </div>
            <nav style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="btn" style={{ padding: "7px 13px" }}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 20px 80px" }}>{children}</main>
      </body>
    </html>
  );
}
