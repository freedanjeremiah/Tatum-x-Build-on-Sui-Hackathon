"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

// The avatar/profile dropdown is only meaningful when Privy is configured (and
// only safe to call usePrivy() inside PrivyProvider, which Providers.tsx mounts
// only in that case). Load lazily, client-only — when Privy is absent we render
// nothing, so the header never blocks on wallet state.
const ProfileMenuPrivy = dynamic(() => import("./ProfileMenuPrivy"), {
  ssr: false,
});

export default function ProfileMenu() {
  if (!PRIVY_APP_ID) return null;
  return <ProfileMenuPrivy />;
}
