import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TopBar } from "@/components/ui/TopBar";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lectro - Digital Reading Platform",
  description: "Premium reading and knowledge management with AI-powered insights",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lectro",
  },
  keywords: ["reading", "ebooks", "epub", "pdf", "knowledge management", "AI"],
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable}`}>
        <ThemeProvider>
          <div className="app-container">
            <TopBar />
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
