import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

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
  other: {
    "theme-color": "#000000",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
