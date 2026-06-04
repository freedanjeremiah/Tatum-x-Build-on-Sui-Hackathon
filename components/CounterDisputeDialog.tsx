"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@/types/artifact";
import {
  freshEvidenceCidBrowser,
  getClients,
  WalletNotConnectedError,
} from "@/lib/useClients";
import TxLink from "./TxLink";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

/**
 * Counter a raised dispute by submitting fresh counter-evidence. Calls
 * lib/dispute.counterDispute under the hood. Owner-facing: shows when an
 * artifact has a recorded disputeId in this session OR a server-known dispute.
 */
export default function CounterDisputeDialog({
  artifact,
  disputeId,
  open,
  onClose,
  onCountered,
}: {
  artifact: Artifact;
  disputeId: string;
  open: boolean;
  onClose: () => void;
  onCountered: (cid: string, txHash: string) => void;
}) {
  const [counterEvidence, setCounterEvidence] = useState("");
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    cid: string;
    txHash: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setCid(freshEvidenceCidBrowser("Counter"));
      setError(null);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const clients = await getClients();
      const { counterDispute } = await import("@/lib/dispute");
      const { cid: filedCid, txHash } = await counterDispute(
        clients,
        artifact.ipId,
        cid,
      );
      setResult({ cid: filedCid, txHash });
      onCountered(filedCid, txHash);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to counter the dispute.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="panel"
        style={{ width: "min(540px, 100%)", padding: 22 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {result ? (
          <div>
            <DisclosureStrip tone="public" icon="check">
              Counter-evidence{" "}
              <span className="font-mono" style={{ fontSize: 11 }}>
                {result.cid.slice(0, 10)}…{result.cid.slice(-6)}
              </span>{" "}
              submitted. <TxLink hash={result.txHash} />
            </DisclosureStrip>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 11.5,
                color: "var(--ov-text-faint)",
              }}
            >
              A reviewer will evaluate both sides off-chain. The counter-evidence
              event is now recorded on Sui.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="btn btn-accent"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 4,
              }}
            >
              <span
                style={{ color: "var(--tier-public)", display: "inline-flex" }}
              >
                <Icon name="shield" size={17} />
              </span>
              <span
                className="eyebrow"
                style={{ color: "var(--tier-public)" }}
              >
                COUNTER DISPUTE #{disputeId}
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: 6 }}
                onClick={onClose}
                aria-label="Close dialog"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
            <h3
              style={{
                fontSize: 18,
                margin: "4px 0 16px",
                color: "var(--ov-text)",
              }}
            >
              {artifact.title}
            </h3>

            <label style={{ display: "block" }}>
              <span className="field-label">Counter-evidence</span>
              <textarea
                className="textarea"
                rows={4}
                value={counterEvidence}
                onChange={(e) => setCounterEvidence(e.target.value)}
                placeholder="Explain why the dispute is unfounded — provenance, license terms, or links to upstream evidence."
              />
            </label>

            <div style={{ marginTop: 12 }}>
              <div className="meta" style={{ marginBottom: 6 }}>
                Counter-evidence CID (auto-generated)
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 11.5,
                  padding: "8px 10px",
                  background: "var(--ov-bg-elev)",
                  borderRadius: 8,
                  border: "1px solid var(--ov-line)",
                  wordBreak: "break-all",
                }}
              >
                {cid}
              </div>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "var(--ov-text-dim)",
                lineHeight: 1.5,
                marginTop: 14,
              }}
            >
              Submitting counter-evidence is permissionless on Sui and posts no
              bond — it records a CounterEvidence event for the off-chain
              reviewer. It does not clear the disputed flag; resolution is
              off-chain.
            </p>

            {error ? (
              <div style={{ marginTop: 12 }}>
                <DisclosureStrip tone="gated" icon="flag">
                  {error}
                </DisclosureStrip>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !counterEvidence.trim()}
                onClick={handleSubmit}
                style={{
                  background: "var(--tier-public)",
                  color: "#fff",
                  boxShadow: "3px 3px 0 var(--ov-navy)",
                }}
              >
                {busy ? <Spinner /> : null}
                {busy ? "Submitting…" : "Submit counter-evidence"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
