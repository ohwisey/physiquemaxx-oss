import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Anton } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PHYSIQUEMAXX",
  description: "No-BS physique intelligence.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PHYSIQUEMAXX",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#070807",
  width: "device-width",
  initialScale: 1,
  // pinch zoom stays available — never cap user scaling (a11y)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${anton.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
