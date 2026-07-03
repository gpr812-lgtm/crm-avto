import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CRM Отдел продаж — Управление сделками и аналитика",
  description: "CRM-система для автомобильного дилерского центра: сделки, трафик, план-факт, аналитика, календарь.",
  keywords: ["CRM", "автосалон", "продажи", "сделки", "аналитика", "CHERY", "Tenet"],
  authors: [{ name: "Sales Department" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-[#f0f2f5] text-[#2c3e50]`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
