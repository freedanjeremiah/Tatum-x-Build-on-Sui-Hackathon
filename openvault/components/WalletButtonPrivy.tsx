"use client";

import { usePrivy } from "@privy-io/react-auth";

/** Real-mode wallet control. Only mounted inside PrivyProvider. */
export default function WalletButtonPrivy() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <span className="rounded-full border border-[var(--ov-line)] px-3.5 py-1.5 text-xs text-[var(--ov-text-faint)]">
        …
      </span>
    );
  }

  if (authenticated) {
    const addr = user?.wallet?.address;
    const short = addr ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : "Connected";
    return (
      <button
        type="button"
        onClick={() => logout()}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--ov-accent)]/40 bg-[var(--ov-accent)]/10 px-3.5 py-1.5 font-mono text-xs text-[var(--ov-text)] transition-colors hover:border-[var(--ov-accent)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-accent)]" />
        {short}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => login()}
      className="rounded-full bg-[var(--ov-accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ov-accent-ink)] transition-opacity hover:opacity-90"
    >
      Connect
    </button>
  );
}
