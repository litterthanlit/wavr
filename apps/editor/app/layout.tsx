import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wavr — Animated Gradient Editor",
  description: "Create and export animated gradient backgrounds with WebGL",
  openGraph: {
    title: "Wavr — Animated Gradient Editor",
    description: "Create and export animated gradient backgrounds with WebGL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wavr — Animated Gradient Editor",
    description: "Create and export animated gradient backgrounds with WebGL",
  },
};

// litt's --litt-canvas in each theme (lib/litt/tokens.css).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
