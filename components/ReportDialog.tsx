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

interface ReportDialogProps {
  artifact: Artifact;
  open: boolean;
  onClose: () => void;
  onDisputed: (disputeId: string) => void;
}

export default function ReportDialog({
  artifact,
  open,
  onClose,
  onDisputed,
}: ReportDialogProps) {
  const [evidence, setEvidence] = useState("");
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    disputeId: string;
    txHash: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setCid(freshEvidenceCidBrowser());
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
      const { raiseReport } = await import("@/lib/dispute");
      const reason = evidence.trim() || "IMPROPER_REGISTRATION";
      const { disputeId, txHash } = await raiseReport(
        clients,
        artifact.ipId,
        cid,
        reason,
      );
      const id = String(disputeId);
      setResult({ disputeId: id, txHash });
      onDisputed(id);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to raise the report.",
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
        style={{ width: "min(520px, 100%)", padding: 22 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {result ? (
          <div>
            <DisclosureStrip tone="gated" icon="flag">
              Dispute #{result.disputeId} raised against this artifact.{" "}
              <TxLink hash={result.txHash} />
            </DisclosureStrip>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 11.5,
                color: "var(--ov-text-faint)",
              }}
            >
              A reviewer will assess the evidence during the liveness window.
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
                style={{
                  color: "var(--tier-gated)",
                  display: "inline-flex",
                }}
              >
                <Icon name="flag" size={17} />
              </span>
              <span
                className="eyebrow"
                style={{ color: "var(--tier-gated)" }}
              >
                REPORT ARTIFACT
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
              <span className="field-label">Evidence</span>
              <textarea
                className="textarea"
                rows={4}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Describe why this artifact is improperly registered, infringing, or fraudulent."
              />
            </label>

            <div style={{ marginTop: 12 }}>
              <div className="meta" style={{ marginBottom: 6 }}>
                Evidence CID (auto-generated)
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
              Raising a report is permissionless on Sui — it sets the
              artifact&apos;s on-chain <span className="font-mono">disputed</span>{" "}
              flag and emits the evidence event. There is no on-chain bond;
              arbitration (resolution, any slashing) is handled off-chain by a
              reviewer.
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
                disabled={busy || !evidence.trim()}
                onClick={handleSubmit}
                style={{
                  background: "var(--tier-gated)",
                  color: "#fff",
                  boxShadow: "3px 3px 0 var(--ov-navy)",
                }}
              >
                {busy ? <Spinner /> : null}
                {busy ? "Raising…" : "Raise dispute"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
