"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { SUI_EXPLORER_OBJECT } from "@/lib/constants";
import Icon from "./ui/Icon";

/** Real-mode wallet control. Only mounted inside PrivyProvider. */
export default function WalletButtonPrivy() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!ready) {
    return (
      <span className="btn btn-ghost btn-sm" style={{ opacity: 0.6 }}>
        …
      </span>
    );
  }

  if (!authenticated) {
    return (
      <button type="button" className="btn btn-accent btn-sm" onClick={() => login()}>
        <Icon name="key" size={13} />
        Connect
      </button>
    );
  }

  const addr = user?.wallet?.address;
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "Connected";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm font-mono"
        style={{ letterSpacing: "0.02em" }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="tier-dot"
          style={{ background: "var(--tier-public)" }}
        />
        {short}
      </button>
      {open ? (
        <div
          className="panel anim-up"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 244,
            padding: 12,
            zIndex: 60,
          }}
        >
          <div className="meta" style={{ marginBottom: 6 }}>
            Connected wallet
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 12,
              wordBreak: "break-all",
              color: "var(--ov-text)",
              marginBottom: 10,
            }}
          >
            {addr ?? "—"}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: "flex-start" }}
              onClick={() => {
                if (addr) navigator.clipboard?.writeText(addr).catch(() => {});
              }}
            >
              <Icon name="copy" size={13} />
              Copy address
            </button>
            <a
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: "flex-start" }}
              href={addr ? `${SUI_EXPLORER_OBJECT}${addr}` : SUI_EXPLORER_OBJECT}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="external" size={13} />
              View on explorer
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                justifyContent: "flex-start",
                color: "var(--ov-accent)",
                borderColor: "var(--ov-accent)",
              }}
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
