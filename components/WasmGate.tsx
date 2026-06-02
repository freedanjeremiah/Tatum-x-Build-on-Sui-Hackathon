"use client";

import { useEffect, useState } from "react";
import VaultMark from "./ui/VaultMark";
import Spinner from "./ui/Spinner";
import DisclosureStrip from "./ui/DisclosureStrip";

/**
 * Nothing that uses CDR may render before initWasm() resolves. WasmGate blocks
 * its children until the secure runtime is ready.
 */
export default function WasmGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { initWasm } = await import("@piplabs/cdr-sdk");
        await initWasm();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to initialize runtime",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className="container maxw-artifact"
        style={{
          minHeight: "55vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <span className="eyebrow" style={{ color: "var(--tier-gated)" }}>
          Runtime error
        </span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(24px,3vw,32px)",
            color: "var(--ov-text)",
          }}
        >
          Secure runtime failed to start
        </h1>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <VaultMark size={46} />
        <Spinner lg />
        <div
          className="meta"
          style={{ color: "var(--ov-text-dim)" }}
        >
          Initializing secure runtime…
        </div>
        <div
          className="font-jp"
          style={{
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "var(--ov-text-faint)",
          }}
        >
          セキュア ランタイム
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
