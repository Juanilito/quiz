import type { Metadata } from "next";
import { Rubik, JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "🌸 Anime Quiz - Realtime Battle Arena",
  description: "Enter the ultimate anime-style quiz battle! Host or join realtime quiz sessions with neon aesthetics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${rubik.variable} ${jetbrainsMono.variable} ${notoSansJP.variable} antialiased min-h-screen relative theme-crystal overflow-hidden`}
      >
        <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
