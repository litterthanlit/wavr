import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
