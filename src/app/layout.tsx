import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800", "900"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Котики и умножение",
  description: "Карточки для изучения таблицы умножения",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Умножение" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FBF4FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`h-full ${nunito.variable}`}>
      <body className="min-h-full flex flex-col text-[var(--fg)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
