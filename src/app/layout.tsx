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
        className={`${inter.variable} font-sans antialiased bg-[hsl(220,23%,96%)] text-[hsl(215,28%,22%)]`}
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="bottom-right"
          richColors
          closeButton
          duration={4000}
          toastOptions={{
            duration: 4000,
            classNames: {
              error: 'duration-7000',
              success: 'duration-4000',
              warning: 'duration-6000',
            },
          }}
        />
      </body>
    </html>
  );
}
