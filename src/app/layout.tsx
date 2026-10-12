import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { t } from "@/lib/i18n";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800", "900"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: t.app.title,
  description: t.app.description,
  appleWebApp: { capable: true, statusBarStyle: "default", title: t.app.shortTitle },
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
    <html lang={t.lang} suppressHydrationWarning className={`h-full ${nunito.variable}`}>
      <body className="min-h-full flex flex-col text-[var(--fg)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
