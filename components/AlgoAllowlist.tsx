import type { Artifact } from "@/types/artifact";
import { algoName } from "@/lib/compute";
import Icon from "./ui/Icon";

const COMPUTE = "var(--tier-compute)";

/**
 * Compute dataset's hash-pinned permitted algorithms as a transparent list.
 * The allowlist is the privacy boundary for OUTPUTS — only these algorithms
 * ever touch the plaintext, so prefer DP / aggregate algorithms.
 */
export default function AlgoAllowlist({ artifact }: { artifact: Artifact }) {
  const hashes = artifact.allowedAlgoHashes ?? [];

  return (
    <div className="panel" style={{ padding: 20, alignSelf: "start" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 8,
        }}
      >
        <span style={{ color: COMPUTE, display: "inline-flex" }}>
          <Icon name="shield" size={16} />
        </span>
        <span
          className="h2"
          style={{ fontSize: 16, color: "var(--ov-text)" }}
        >
          Algorithm allowlist
        </span>
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--ov-text-dim)",
          lineHeight: 1.55,
          marginTop: 0,
        }}
      >
        Only these algorithms may touch the plaintext. Anything else is rejected
        before a single byte is decrypted.
      </p>

      {hashes.length === 0 ? (
        <p
          style={{
            border: "1px dashed var(--ov-line)",
            borderRadius: 10,
            padding: "16px 12px",
            textAlign: "center",
            fontSize: 12,
            color: "var(--ov-text-faint)",
          }}
        >
          No algorithms are permitted on this dataset.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {hashes.map((h) => (
            <div
              key={h}
              className="panel-soft"
              style={{
                padding: "11px 13px",
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <span className="tier-dot" style={{ background: COMPUTE }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "var(--ov-text)",
                  }}
                >
                  {algoName(h)}
                </div>
                <code
                  className="font-mono"
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--ov-text-faint)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
