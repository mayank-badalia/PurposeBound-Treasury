import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Nav from "@/components/Nav";
import IntroOverlay from "@/components/IntroOverlay";
import ScrollReveal from "@/components/ScrollReveal";
import { gemmaMode } from "@/lib/gemma";
import { razorpayMode } from "@/lib/razorpay";
import { chainConfigured } from "@/lib/hash";
import { driveConfigured } from "@/lib/drive";
import { getGoogle } from "@/lib/store";

export const metadata: Metadata = {
  title: "PurposeBound Treasury",
  description: "Every rupee connected to its promised purpose.",
};

function StatusDot({ label, mode, live }: { label: string; mode: string; live: boolean }) {
  return (
    <span className="chip" title={`${label}: ${mode}`} style={{ padding: "3px 9px", fontSize: 11, background: "rgba(255,255,255,0.5)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: live ? "var(--ok)" : "var(--warn)", display: "inline-block" }} />
      {label} <span style={{ color: live ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>{mode}</span>
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Inter:wght@400;500;600;700&family=UnifrakturCook:wght@700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* No-flash: skip the intro before first paint if it's already been seen
            this session or the viewer prefers reduced motion. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('pb_intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('intro-done')}}catch(e){}",
          }}
        />
      </head>
      <body>
        <IntroOverlay />
        <ScrollReveal />
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(252, 245, 238, 0.82)",
            backdropFilter: "blur(10px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: 1220, margin: "0 auto", padding: "16px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="black-letter" style={{ fontSize: 27, color: "var(--brand)", lineHeight: 1 }}>
                  PurposeBound
                </span>
                <span className="serif" style={{ fontSize: 23, fontWeight: 500, color: "var(--text)" }}>
                  Treasury
                </span>
              </Link>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                <StatusDot label="Gemma" mode={gemma === "gemma" ? "live" : "offline"} live={gemma === "gemma"} />
                <StatusDot label="Razorpay" mode={rzp === "sandbox" ? "sandbox" : "mock"} live={rzp === "sandbox"} />
                <StatusDot label="Chain" mode={chain ? "on-chain" : "simulated"} live={chain} />
                {driveConn ? (
                  <StatusDot label="Drive" mode="connected" live={true} />
                ) : driveReady ? (
                  <a className="chip" href="/api/auth/google" style={{ padding: "3px 9px", fontSize: 11, color: "var(--brand)", borderColor: "var(--brand-2)" }}>
                    Connect Drive
                  </a>
                ) : (
                  <StatusDot label="Drive" mode="not set" live={false} />
                )}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Nav />
            </div>
          </div>
        </header>
        <main style={{ maxWidth: 1220, margin: "0 auto", padding: "30px 24px 90px" }}>{children}</main>
      </body>
    </html>
  );
}
