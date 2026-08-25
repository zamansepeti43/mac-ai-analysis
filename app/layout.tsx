import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maç AI — Yapay Zekâ ile Futbol Analizi",
  description: "Futbol maçlarını veri ve yapay zekâ destekli analizlerle değerlendiren Maç AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
