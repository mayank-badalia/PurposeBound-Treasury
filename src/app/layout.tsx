import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Nav from "@/components/Nav";
import IntroOverlay from "@/components/IntroOverlay";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "PurposeBound Treasury",
  description: "Every rupee connected to its promised purpose.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Inter:wght@400;500;600;700&family=UnifrakturCook:wght@700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* No-flash: skip the intro before first paint only under reduced motion. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('intro-done')}}catch(e){}",
          }}
        />
      </head>
      <body>
        <IntroOverlay />
        <ScrollReveal />
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand" aria-label="PurposeBound Treasury — home">
              <span className="black-letter brand-mark">PurposeBound</span>
              <span className="serif brand-sub">Treasury</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main style={{ maxWidth: 1220, margin: "0 auto", padding: "30px 24px 90px" }}>{children}</main>
      </body>
    </html>
  );
}
