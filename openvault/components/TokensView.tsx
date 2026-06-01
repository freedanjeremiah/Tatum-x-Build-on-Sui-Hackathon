"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  listLicenseTokens,
  type LicenseTokenList,
} from "@/lib/licenseTokens";
import { LICENSE_TOKEN } from "@/lib/constants";
import Spinner from "@/components/ui/Spinner";
import DisclosureStrip from "@/components/ui/DisclosureStrip";
import Icon from "@/components/ui/Icon";

const TOKEN_EXPLORER = "https://aeneid.storyscan.io/token/";

/**
 * My License Tokens — reads the connected wallet's on-chain license token ids.
 * Only mounted inside PrivyProvider (via app/tokens/page → WalletNavLinks-style
 * gate), so usePrivy() is always safe here. Never fabricates token ids: empty,
 * error, and non-enumerable states are all honest.
 */
export default function TokensView() {
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address as `0x${string}` | undefined;

  const [result, setResult] = useState<LicenseTokenList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    listLicenseTokens(address)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div
      className="container maxw-upload"
      style={{ paddingTop: 36, paddingBottom: 64 }}
    >
      <div className="anim-up" style={{ marginBottom: 24 }}>
        <span
          className="eyebrow"
          style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
        >
          <span style={{ color: "var(--ov-accent)", display: "inline-flex" }}>
            <Icon name="key" size={13} />
          </span>
          ON-CHAIN
        </span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(26px,4vw,38px)",
            margin: "10px 0 8px",
            color: "var(--ov-text)",
          }}
        >
          My license tokens
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ov-text-dim)",
            maxWidth: 560,
          }}
        >
          License tokens held by your connected wallet, read live from the Story
          LicenseToken contract on Aeneid. Each gated artifact you unlock mints
          one of these.
        </p>
      </div>

      {/* not connected */}
      {ready && !authenticated ? (
        <div className="panel" style={{ padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ov-text-dim)", fontSize: 14 }}>
            Connect your wallet to see your license tokens.
          </p>
          <p
            className="meta"
            style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
          >
            Use the Connect button in the header.
          </p>
        </div>
      ) : null}

      {/* loading */}
      {authenticated && loading ? (
        <div
          className="panel"
          style={{
            padding: 28,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Spinner />
          <span style={{ color: "var(--ov-text-dim)", fontSize: 13 }}>
            Reading tokens on-chain…
          </span>
        </div>
      ) : null}

      {/* error / could-not-enumerate */}
      {authenticated && !loading && error ? (
        <DisclosureStrip tone="warning" icon="shield">
          Couldn&apos;t enumerate tokens on-chain for this contract — {error}
        </DisclosureStrip>
      ) : null}

      {/* results */}
      {authenticated && !loading && !error && result ? (
        result.tokens.length === 0 ? (
          <div className="panel" style={{ padding: 28, textAlign: "center" }}>
            <p style={{ margin: 0, color: "var(--ov-text-dim)", fontSize: 14 }}>
              You don&apos;t hold any license tokens yet.
            </p>
          </div>
        ) : (
          <>
            <div
              className="meta"
              style={{ margin: "4px 0 12px", color: "var(--ov-text-faint)" }}
            >
              {result.tokens.length} TOKEN
              {result.tokens.length === 1 ? "" : "S"}
              {result.scanned ? " · via Transfer-log scan" : " · via enumeration"}
            </div>
            <div className="panel" style={{ padding: 6 }}>
              {result.tokens.map((t) => (
                <div
                  key={t.tokenId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--ov-line-soft)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--ov-text-faint)",
                      display: "inline-flex",
                    }}
                  >
                    <Icon name="key" size={14} />
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 13, color: "var(--ov-text)" }}
                  >
                    #{t.tokenId}
                  </span>
                  <span style={{ flex: 1 }} />
                  <a
                    href={`${TOKEN_EXPLORER}${LICENSE_TOKEN}/instance/${t.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="txlink"
                  >
                    <span>View</span>
                    <span className="suffix">NFT</span>
                  </a>
                </div>
              ))}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
