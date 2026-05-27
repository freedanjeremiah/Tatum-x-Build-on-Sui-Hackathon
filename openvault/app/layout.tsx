import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import WasmGate from "@/components/WasmGate";
import CdrLimitsNotice from "@/components/CdrLimitsNotice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenVault",
  description:
    "Access control as a property of the data. A confidential model & dataset hub on Story + CDR.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div id="ov-root" className="flex min-h-screen flex-col">
          <Providers>
            <Header />
            <WasmGate>
              <main className="flex-1">{children}</main>
            </WasmGate>
            <Footer />
          </Providers>
        </div>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/50">
      <div className="mx-auto max-w-[1400px] space-y-6 px-5 py-10">
        <CdrLimitsNotice />
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="text-[13px] font-semibold text-[var(--ov-text)]">
              Open<span className="text-[var(--ov-accent)]">Vault</span>
            </div>
            <p className="text-[12px] text-[var(--ov-text-dim)]">
              Access control as a property of the data — encrypt once, gate by
              license, compute without ever downloading.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--ov-text-faint)]">
            Story · CDR · Aeneid
          </div>
        </div>
      </div>
    </footer>
  );
}
