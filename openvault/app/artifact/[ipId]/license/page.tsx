// License & Access tab. Index-only (no keys / no plaintext). Shows the tier's
// access summary, the on-chain license-terms references (with Story explorer
// links), a PIL summary line, and — for the gated tier — the same mint-to-unlock
// flow the Card tab uses (DownloadButton).

export const runtime = "nodejs";

import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact, Tier } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import { TierGlyph } from "@/components/ui/TierBadge";
import DisclosureStrip from "@/components/ui/DisclosureStrip";
import DownloadButton from "@/components/DownloadButton";

// Story IP explorer license-terms page. Derived from the IPA explorer base in
// lib/constants.ts so it tracks the same network.
const EXPLORER_LICENSE = "https://aeneid.explorer.story.foundation/license/";

// PIL (Programmable IP License) one-line summary per tier. These describe the
// real access policy each tier registers on Story.
const PIL_SUMMARY: Record<Tier, string> = {
  public: "Commercial use · attribution license attached",
  gated: "Commercial · mint a license token to decrypt",
  private: "Owner-only · not licensed for others",
  group: "Group license · subscribe to the pool",
  compute: "Compute license · pay per job, never downloadable",
};

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function LicensePage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;
  if (!artifact) return null;

  const t = tierMeta(artifact.tier);
  const isGated = artifact.tier === "gated";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Access summary */}
      <div
        className="panel"
        style={{
          padding: 20,
          borderColor: `color-mix(in srgb, ${t.color} 45%, var(--ov-line-ink))`,
          background: `color-mix(in srgb, ${t.color} 6%, var(--ov-panel))`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 6,
          }}
        >
          <TierGlyph tier={artifact.tier} size={16} />
          <span className="h2" style={{ fontSize: 16, color: "var(--ov-text)" }}>
            {t.label} access
          </span>
        </div>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 13,
            color: "var(--ov-text-dim)",
          }}
        >
          {t.license}.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--ov-text-faint)",
          }}
        >
          {PIL_SUMMARY[artifact.tier]}
        </p>

        {isGated ? (
          <div style={{ marginTop: 16 }}>
            <DownloadButton artifact={artifact} />
          </div>
        ) : null}
      </div>

      {/* License terms references */}
      <div className="panel" style={{ padding: 20 }}>
        <div
          className="h2"
          style={{ fontSize: 16, marginBottom: 14, color: "var(--ov-text)" }}
        >
          License terms
        </div>

        {artifact.licenseTermsId || artifact.computeLicenseTermsId ? (
          <div style={{ display: "grid", gap: 12 }}>
            {artifact.licenseTermsId ? (
              <TermsRow
                label="License terms"
                id={artifact.licenseTermsId}
              />
            ) : null}
            {artifact.computeLicenseTermsId ? (
              <TermsRow
                label="Compute license"
                id={artifact.computeLicenseTermsId}
              />
            ) : null}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--ov-text-dim)",
            }}
          >
            No license-terms id is indexed for this artifact.
          </p>
        )}
      </div>

      {artifact.tier === "private" ? (
        <DisclosureStrip tone="warning" icon="lock">
          This artifact is owner-only and not licensed for others. There is no
          mint-to-unlock path — only the registering wallet can decrypt it.
        </DisclosureStrip>
      ) : null}
    </div>
  );
}

function TermsRow({ label, id }: { label: string; id: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
        {label}
      </span>
      <a
        href={`${EXPLORER_LICENSE}${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="txlink"
        title={`View license terms #${id} on the Story explorer`}
      >
        <span className="font-mono">#{id}</span>
        <span className="suffix">PIL</span>
      </a>
    </div>
  );
}
