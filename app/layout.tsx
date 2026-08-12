import type { Metadata } from "next";
import "./globals.css";
import "./checkin.css";

export const metadata: Metadata = {
  title: "VALF Suite | Casa vacanze ad Arcola, Liguria",
  description: "VALF Suite è una casa vacanze indipendente ad Arcola, base ideale per scoprire Cinque Terre, Golfo dei Poeti, Lunigiana e Toscana.",
  metadataBase: new URL("https://valfsuite.valfservice.it"),
  openGraph: {
    title: "VALF Suite | Arcola · Liguria",
    description: "Il tuo punto di partenza tra Liguria e Toscana.",
    url: "https://valfsuite.valfservice.it",
    siteName: "VALF Suite",
    locale: "it_IT",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "VALF Suite, Arcola Liguria" }],
  },
  twitter: { card: "summary_large_image", title: "VALF Suite", description: "Casa vacanze ad Arcola, tra Liguria e Toscana.", images: ["/og.png"] },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
