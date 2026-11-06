import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Footer />
    </>
  );
}
