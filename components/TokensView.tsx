"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  listLicenseTokens,
  type LicenseTokenList,
} from "@/lib/licenseTokens";
import type { Artifact } from "@/types/artifact";
import { SUI_EXPLORER_OBJECT } from "@/lib/constants";
import Spinner from "@/components/ui/Spinner";
import DisclosureStrip from "@/components/ui/DisclosureStrip";
import Icon from "@/components/ui/Icon";

/**
 * My License Tokens — reads which on-chain artifacts the connected wallet holds
 * a license for. On Sui a "license token" is membership of an artifact's
 * `license_holders` set, not an enumerable NFT, so we check the wallet against a
 * candidate set sourced from the app's own index of gated/group artifacts.
 *
 * Only mounted inside PrivyProvider, so usePrivy() is always safe here. Never
 * fabricates ids: empty, error, and "needs-indexer" states are all honest.
 */
export default function TokensView() {
  const { ready, authenticated, user } = usePrivy();
  const address = user?.wallet?.address as `0x${string}` | undefined;

  const [result, setResult] = useState<LicenseTokenList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const { makeSuiClient } = await import("@/lib/clients");
        const client = makeSuiClient();

        // Source candidate artifact ids from the app index. On Sui there is no
        // owner-side object to enumerate, so we check membership against the
        // gated/group artifacts the app already knows about (honest: a full
        // enumeration needs an event indexer — see lib/licenseTokens header).
        let candidateArtifactIds: string[] | undefined;
        try {
          const r = await fetch("/api/index");
          if (r.ok) {
            const data = (await r.json()) as Artifact[];
            if (Array.isArray(data)) {
              candidateArtifactIds = data
                .filter((a) => a.tier === "gated" || a.tier === "group")
                .map((a) => a.ipId);
            }
          }
        } catch {
          // Index unreachable — fall through with no candidates (honest empty).
        }

        const r = await listLicenseTokens(client, address, {
          candidateArtifactIds,
        });
        if (!cancelled) setResult(r);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
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
          Artifacts your connected wallet holds a license for, read live from the
          Reef registry on Sui. Each gated or group artifact you unlock adds
          your address to that artifact&apos;s on-chain license holders.
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
          Couldn&apos;t read license membership on-chain — {error}
        </DisclosureStrip>
      ) : null}

      {/* results */}
      {authenticated && !loading && !error && result ? (
        result.tokens.length === 0 ? (
          <div className="panel" style={{ padding: 28, textAlign: "center" }}>
            <p style={{ margin: 0, color: "var(--ov-text-dim)", fontSize: 14 }}>
              You don&apos;t hold any license tokens yet.
            </p>
            {!result.indexed ? (
              <p
                className="meta"
                style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
              >
                No candidate artifacts were available to check. A full wallet-wide
                enumeration needs an off-chain event indexer.
              </p>
            ) : (
              <p
                className="meta"
                style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
              >
                Checked {result.checked} candidate artifact
                {result.checked === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        ) : (
          <>
            <div
              className="meta"
              style={{ margin: "4px 0 12px", color: "var(--ov-text-faint)" }}
            >
              {result.tokens.length} TOKEN
              {result.tokens.length === 1 ? "" : "S"}
              {" · "}
              {result.checked} candidate
              {result.checked === 1 ? "" : "s"} checked
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
                    {t.artifactId.slice(0, 8)}…{t.artifactId.slice(-6)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <a
                    href={`${SUI_EXPLORER_OBJECT}${t.artifactId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="txlink"
                  >
                    <span>View</span>
                    <span className="suffix">OBJ</span>
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
