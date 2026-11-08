import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import "./motion.css";

import { Ambient, MotionRuntime } from "@/components/Motion";
import { Providers } from "@/components/Providers";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: { default: "Allowance", template: "%s | Allowance" },
  description: "An on-chain spending firewall for AI agents paying over x402 on Solana.",
};

export const viewport: Viewport = { themeColor: "#05040a", colorScheme: "dark" };

// Hide reveal targets only when JS is running, before first paint, so nothing flashes and no-JS still shows everything.
const BOOT = `document.documentElement.classList.add("motion-ready")`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={grotesk.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Ambient />
        <MotionRuntime />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
