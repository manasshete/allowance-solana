import type { Metadata } from "next";
import { Chivo_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

import { Providers } from "@/components/Providers";

const chivo = Chivo_Mono({ subsets: ["latin"], weight: ["400", "500", "800"], variable: "--font-chivo" });

export const metadata: Metadata = {
  title: { default: "Allowance", template: "%s | Allowance" },
  description: "An on-chain spending firewall for AI agents paying over x402 on Solana.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={chivo.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
