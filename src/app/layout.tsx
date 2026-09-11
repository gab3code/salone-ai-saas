import type { Metadata } from "next";
import "./globals.css";

// Font di sistema (nessuna dipendenza da Google Fonts al momento della build):
// più veloce e affidabile in qualsiasi ambiente, anche senza rete verso
// fonts.googleapis.com (problema riscontrato nel sandbox cloud). L'init di
// shadcn (11/09/2026, installazione componenti beautifui) aveva reintrodotto
// Geist da next/font/google -- ripristinato ai font di sistema.
const fontVariablesClassName = "font-sans";

export const metadata: Metadata = {
  title: "Salone AI SaaS",
  description: "SaaS self-service per centri estetici, parrucchieri e barbieri",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${fontVariablesClassName} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
