"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

// Privy-backed nav links are only meaningful when a Privy app id is configured
// (and only safe to call usePrivy() inside PrivyProvider, which Providers.tsx
// mounts only in that case). Load lazily, client-only — when Privy is absent we
// render nothing so the static nav (Browse/Search/Upload/Leaderboard/About)
// always shows.
const WalletNavLinksPrivy = dynamic(() => import("./WalletNavLinksPrivy"), {
  ssr: false,
});

export default function WalletNavLinks() {
  if (!PRIVY_APP_ID) return null;
  return <WalletNavLinksPrivy />;
}
