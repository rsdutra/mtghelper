import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "ARCHIVIST // MTG",
  description: "Organize coleções, confira decks e planeje upgrades de Magic: The Gathering.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geist.variable} ${jetbrains.variable} min-h-screen bg-background text-on-surface antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
