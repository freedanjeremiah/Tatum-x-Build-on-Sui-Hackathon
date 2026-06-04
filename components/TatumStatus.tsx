"use client";

// Network/gas status indicator — shows Reef's RPC + data flowing via Tatum.
//
// Reads /api/tatum/status (server-side; the TATUM_API_KEY never reaches the
// browser). Renders the Sui network + live reference gas price and latest
// checkpoint from the Tatum Sui gateway. Honest when disabled/unavailable:
// shows "—" rather than any fabricated value, and labels the source as Tatum.

import { useEffect, useState } from "react";

interface StatusResponse {
  configured: boolean;
  via?: string;
  network?: string;
  referenceGasPrice?: string;
  checkpoint?: string;
  epoch?: string;
  error?: string;
}

const DASH = "—";

export default function TatumStatus() {
  const [s, setS] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/tatum/status", { cache: "no-store" });
        const data = (await res.json()) as StatusResponse;
        if (alive) setS(data);
      } catch {
        if (alive) setS({ configured: false });
      }
    }
    void load();
    // Refresh periodically so the gas price stays live during a demo.
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const network = s?.network ?? "Sui testnet";
  const enabled = Boolean(s?.configured && !s?.error && s?.referenceGasPrice);
  const gas = enabled ? s!.referenceGasPrice : DASH;
  const checkpoint = enabled && s?.checkpoint ? s.checkpoint : DASH;

  return (
    <span
      className="meta ov-network"
      title={
        enabled
          ? `RPC + data via Tatum · gas ${gas} MIST · checkpoint ${checkpoint}` +
            (s?.epoch ? ` · epoch ${s.epoch}` : "")
          : "RPC + data via Tatum (status unavailable without TATUM_API_KEY)"
      }
      style={{
        color: "var(--ov-text-faint)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: enabled ? "var(--ov-accent)" : "var(--ov-text-faint)",
          display: "inline-block",
          opacity: enabled ? 1 : 0.5,
        }}
      />
      <span>{network}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>gas {gas}</span>
      <span style={{ opacity: 0.5, fontSize: "0.85em" }}>via Tatum</span>
    </span>
  );
}
