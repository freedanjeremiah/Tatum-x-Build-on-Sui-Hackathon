import type { Metadata } from "next";
import { Caveat } from "next/font/google";

const caveat = Caveat({
  variable: "--font-script",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reef — Pitch · Vol. 01",
  description:
    "Tatum × Walrus hackathon · Vol. 01 — Reef. Access control as a property of the data, not the platform. Built on Sui + Walrus + Seal + Tatum + Nautilus TEE.",
};

export default function PitchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={caveat.variable}>{children}</div>;
}
