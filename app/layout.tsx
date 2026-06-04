import type { Metadata } from "next";
import {
  DM_Sans,
  JetBrains_Mono,
  Noto_Sans_JP,
  Oswald,
} from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import WasmGate from "@/components/WasmGate";
import SealLimitsNotice from "@/components/SealLimitsNotice";

const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dmsans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const jetMono = JetBrains_Mono({
  variable: "--font-jetmono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const notoJP = Noto_Sans_JP({
  variable: "--font-notojp",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Reef — Confidential Data Registry",
  description:
    "Access control as a property of the data. A confidential model & dataset hub on Sui, Walrus & Seal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${dmSans.variable} ${jetMono.variable} ${notoJP.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div id="ov-root" className="ov-app flex min-h-screen flex-col">
          <Providers>
            <Header />
            <WasmGate>
              <main className="flex-1">{children}</main>
            </WasmGate>
            <SealLimitsNotice />
          </Providers>
        </div>
      </body>
    </html>
  );
}
