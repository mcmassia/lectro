import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// import { Sidebar } from "@/components/ui/Sidebar";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { RightSidebar } from "@/components/home/HomeSidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lectro - Digital Reading Platform",
  description: "Premium reading and knowledge management with AI-powered insights",
  keywords: ["reading", "ebooks", "epub", "pdf", "knowledge management", "AI"],
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
            <RightSidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
