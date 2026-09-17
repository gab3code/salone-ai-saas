import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { RegistraServiceWorker } from "./registra-service-worker";

// Un solo font, deliberato, in tutta l'app (richiesta esplicita di Gabriel,
// Giro 3: "scegli un font e mantienilo in tutta la pagina"). Prima si usava
// next/font/google, ma il build in questo sandbox non riesce a raggiungere
// fonts.googleapis.com (proxy di rete del sandbox, 403 sul CONNECT) -- non
// era un problema transitorio, riprovato e confermato bloccato. Passato a
// @fontsource-variable/inter: stesso font Inter, ma i file woff2 sono
// scaricati da npm (raggiungibile) e impacchettati nel bundle a build time,
// zero dipendenze di rete sia in build che a runtime per l'utente finale.
// Font variabile (un solo file copre tutti i pesi 100-900 usati nella
// landing: font-medium, font-semibold, ecc.).

export const metadata: Metadata = {
  title: "Salone AI SaaS",
  description: "SaaS self-service per centri estetici, parrucchieri e barbieri",
  // PWA installabile (Fase 4 di PIANO.md) -- manifest servito automaticamente
  // da app/manifest.ts, qui solo l'icona per iOS ("Aggiungi a Home" non legge
  // il manifest come Android/Chrome, vuole il proprio <link rel="apple-touch-icon">).
  icons: { apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Salone AI" },
};

export const viewport: Viewport = {
  themeColor: "#07040d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // data-scroll-behavior: lo `scroll-behavior: smooth` che globals.css mette
  // sull'html vale anche per i cambi di pagina, e Next avvisa a ogni
  // navigazione perche' non sa se e' voluto. Qui lo e': serve per le ancore
  // della landing. Dichiararlo toglie l'avviso senza cambiare niente.
  return (
    <html lang="it" data-scroll-behavior="smooth" className="font-sans h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <RegistraServiceWorker />
      </body>
    </html>
  );
}
