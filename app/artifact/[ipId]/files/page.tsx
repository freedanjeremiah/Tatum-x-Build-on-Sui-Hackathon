// Files & Versions tab. Index-only. Shows the single registration version with
// its on-chain tx, and the file's blob id. Public artifacts link the blob through
// the Walrus aggregator "in the clear"; encrypted tiers show the blob id + vault
// handle behind an honest "threshold-sealed — not downloadable here" disclosure.
// No fabricated file sizes.

export const runtime = "nodejs";

import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import { WALRUS_AGGREGATOR } from "@/lib/constants";
import TxLink from "@/components/TxLink";
import DisclosureStrip from "@/components/ui/DisclosureStrip";

// Same Walrus aggregator the public download path uses (see DownloadButton).
const GATEWAY = `${WALRUS_AGGREGATOR.replace(/\/+$/, "")}/v1/blobs/`;

function cidHash(cid: string): string {
  return cid.replace(/^walrus:\/\//, "");
}

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function FilesPage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;
  if (!artifact) return null;

  const isPublic = artifact.tier === "public";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Versions */}
      <div className="panel" style={{ padding: 20 }}>
        <div
          className="h2"
          style={{ fontSize: 16, marginBottom: 14, color: "var(--ov-text)" }}
        >
          Versions
        </div>
        <Row>
          <div style={{ display: "grid", gap: 3 }}>
            <span style={{ fontSize: 13.5, color: "var(--ov-text)" }}>
              v1 · initial registration
            </span>
            <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
              Registered on Sui
            </span>
          </div>
          <TxLink hash={artifact.createdTx} />
        </Row>
      </div>

      {/* Files */}
      <div className="panel" style={{ padding: 20 }}>
        <div
          className="h2"
          style={{ fontSize: 16, marginBottom: 14, color: "var(--ov-text)" }}
        >
          Files
        </div>

        {!artifact.cid ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--ov-text-dim)",
            }}
          >
            No blob id indexed for this artifact.
          </p>
        ) : isPublic ? (
          <>
            <Row>
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: "var(--ov-text)" }}>
                  Payload · in the clear
                </span>
                <a
                  href={`${GATEWAY}${cidHash(artifact.cid)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--ov-accent)",
                    wordBreak: "break-all",
                  }}
                >
                  {artifact.cid}
                </a>
              </div>
              <a
                href={`${GATEWAY}${cidHash(artifact.cid)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Open on Walrus
              </a>
            </Row>
            <div style={{ marginTop: 14 }}>
              <DisclosureStrip tone="public" icon="shield">
                Public artifact — the payload is stored unencrypted on Walrus and
                fetchable directly from the aggregator above.
              </DisclosureStrip>
            </div>
          </>
        ) : (
          <>
            <Row>
              <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
                Blob id
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11.5,
                  color: "var(--ov-text)",
                  wordBreak: "break-all",
                  textAlign: "right",
                }}
              >
                {artifact.cid}
              </span>
            </Row>
            {artifact.vaultUuid !== undefined ? (
              <Row>
                <span
                  className="meta"
                  style={{ color: "var(--ov-text-faint)" }}
                >
                  Vault uuid
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "var(--ov-text)" }}
                >
                  uuid:{artifact.vaultUuid}
                </span>
              </Row>
            ) : null}
            <div style={{ marginTop: 14 }}>
              <DisclosureStrip tone="gated" icon="lock">
                Encrypted · threshold-sealed — contents are not downloadable
                here. Access is gated by the artifact&apos;s license terms.
              </DisclosureStrip>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--ov-line-soft)",
      }}
    >
      {children}
    </div>
  );
}
