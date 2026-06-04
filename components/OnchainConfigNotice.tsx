"use client";

import { useState } from "react";
import {
  ONCHAIN_CONFIGURED,
  REEF_PACKAGE_ID,
  SEAL_KEY_SERVER_IDS,
} from "@/lib/constants";
import Icon from "./ui/Icon";

/**
 * Honest on-chain config banner.
 *
 * When the Reef Move package id or the Seal key-server ids are unset, write +
 * decrypt paths cannot work. Rather than letting those paths throw opaque
 * errors deep in a flow, we surface a clear, dismissible banner up front so the
 * app degrades gracefully. Reads/browse still work.
 *
 * Config is read from lib/constants (NEXT_PUBLIC_OV_* are browser-visible), so
 * this renders consistently in the client bundle.
 */
export default function OnchainConfigNotice() {
  const [dismissed, setDismissed] = useState(false);

  // Fully configured → nothing to warn about.
  if (ONCHAIN_CONFIGURED || dismissed) return null;

  const missing: string[] = [];
  if (!REEF_PACKAGE_ID || REEF_PACKAGE_ID.trim().length === 0)
    missing.push("the Reef Move package id (set NEXT_PUBLIC_OV_REEF_PACKAGE_ID)");
  if (SEAL_KEY_SERVER_IDS.length === 0)
    missing.push(
      "Seal key-server ids (set NEXT_PUBLIC_OV_SEAL_KEY_SERVER_IDS)",
    );

  return (
    <div
      role="status"
      style={{
        borderBottom: "1.5px solid var(--ov-line-ink)",
        background:
          "color-mix(in srgb, var(--tier-gated) 10%, var(--ov-bg-2))",
      }}
    >
      <div
        className="container maxw-browse"
        style={{
          paddingTop: 10,
          paddingBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: "var(--tier-gated)", display: "inline-flex" }}>
          <Icon name="flag" size={15} />
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: "var(--ov-text-dim)",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          On-chain features need configuration — publish the Move package and set
          Seal key servers. Until then, browsing works but publishing and
          decrypting are disabled. Missing: {missing.join("; ")}.
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{ flex: "none" }}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    </div>
  );
}
