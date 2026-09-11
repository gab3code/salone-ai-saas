import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="font-sans h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
