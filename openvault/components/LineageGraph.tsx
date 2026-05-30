"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@/types/artifact";
import TxLink from "./TxLink";
import { TierBadge } from "./ui/TierBadge";
import Icon from "./ui/Icon";

interface LineageGraphProps {
  artifact: Artifact;
}

/**
 * Parent ↔ this ↔ children chain. Walks up via /api/index?ipId=parent and
 * down by scanning siblings whose `parentIpId` matches `this`. Each node is a
 * panel-soft box; edges are labelled DERIVATIVE arrows in the MECHATONE
 * language.
 */
export default function LineageGraph({ artifact }: LineageGraphProps) {
  const [parents, setParents] = useState<Artifact[]>([]);
  const [children, setChildren] = useState<Artifact[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function walk() {
      // Up — at most two levels.
      const upChain: Artifact[] = [];
      let parentId = artifact.parentIpId;
      let depth = 0;
      while (parentId && depth < 2) {
        try {
          const r = await fetch(`/api/index?ipId=${parentId}`);
          const data = (await r.json()) as Artifact | { error: string };
          if (!data || "error" in data) break;
          upChain.unshift(data);
          parentId = data.parentIpId;
        } catch {
          break;
        }
        depth++;
      }

      // Down — siblings whose parent === this (cap at 3 for layout).
      let downKids: Artifact[] = [];
      try {
        const r = await fetch(`/api/index`);
        const all = (await r.json()) as Artifact[];
        if (Array.isArray(all)) {
          downKids = all.filter((a) => a.parentIpId === artifact.ipId).slice(0, 3);
        }
      } catch {
        /* best-effort */
      }

      if (!cancelled) {
        setParents(upChain);
        setChildren(downKids);
      }
    }
    walk();
    return () => {
      cancelled = true;
    };
  }, [artifact.ipId, artifact.parentIpId]);

  const hasAnything =
    parents.length > 0 || children.length > 0 || !!artifact.externalSource;

  if (!hasAnything) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--ov-text-dim)" }}>
        Original work — no upstream or downstream lineage recorded.
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        {artifact.externalSource && parents.length === 0 ? (
          <>
            <OssNode source={artifact.externalSource} />
            <Arrow />
          </>
        ) : null}
        {parents.map((p) => (
          <span
            key={p.ipId}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <LineageBox a={p} />
            <Arrow />
          </span>
        ))}
        <LineageBox a={artifact} isThis />
        {children.length > 0 ? <Arrow /> : null}
        {children.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {children.map((c) => (
              <LineageBox key={c.ipId} a={c} />
            ))}
          </div>
        ) : null}
      </div>
      <p
        style={{
          margin: "12px 0 0",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11.5,
          color: "var(--ov-text-faint)",
        }}
      >
        <span style={{ color: "var(--ov-accent)", display: "inline-flex" }}>
          <Icon name="arrow" size={13} />
        </span>
        Royalties route upstream per each link&apos;s license terms.
      </p>
    </div>
  );
}

function LineageBox({ a, isThis = false }: { a: Artifact; isThis?: boolean }) {
  return (
    <div
      className="panel-soft"
      style={{
        padding: "12px 14px",
        minWidth: 190,
        position: "relative",
        borderColor: isThis ? "var(--ov-accent)" : "var(--ov-line)",
        borderWidth: isThis ? 2 : 1.5,
      }}
    >
      {isThis ? (
        <span
          className="meta"
          style={{
            color: "var(--ov-accent)",
            position: "absolute",
            top: 8,
            right: 10,
          }}
        >
          THIS
        </span>
      ) : null}
      <TierBadge tier={a.tier} />
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          margin: "8px 0",
          color: "var(--ov-text)",
        }}
      >
        {a.title}
      </div>
      <TxLink ipId={a.ipId} />
    </div>
  );
}

function OssNode({ source }: { source: string }) {
  return (
    <div
      className="panel-soft"
      style={{
        padding: "12px 14px",
        minWidth: 190,
        borderStyle: "dashed",
      }}
    >
      <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
        OSS source
      </span>
      <a
        href={source}
        target="_blank"
        rel="noreferrer"
        className="font-mono"
        style={{
          display: "block",
          marginTop: 6,
          fontSize: 11.5,
          color: "var(--ov-accent)",
          wordBreak: "break-all",
        }}
      >
        {source.replace("https://", "").slice(0, 42)}
        {source.length > 42 ? "…" : ""}
      </a>
    </div>
  );
}

function Arrow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "var(--ov-text-faint)",
        padding: "0 4px",
      }}
    >
      <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
        DERIVATIVE
      </span>
      <Icon name="arrow" size={16} />
    </div>
  );
}
