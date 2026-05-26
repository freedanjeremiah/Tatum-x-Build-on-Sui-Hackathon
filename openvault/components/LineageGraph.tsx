"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import TxLink from "./TxLink";

interface LineageGraphProps {
  artifact: Artifact;
}

/**
 * Parent → child lineage chain. Walks up via /api/index?ipId=parent (one or two
 * levels) and renders each node as a small on-theme card with an edge label for
 * the license terms / "derivative" relationship. Royalties route upstream per
 * those terms.
 */
export default function LineageGraph({ artifact }: LineageGraphProps) {
  const [chain, setChain] = useState<Artifact[]>([artifact]);

  useEffect(() => {
    let cancelled = false;
    async function walk() {
      const nodes: Artifact[] = [artifact];
      let parentId = artifact.parentIpId;
      let depth = 0;
      while (parentId && depth < 2) {
        try {
          const r = await fetch(`/api/index?ipId=${parentId}`);
          const data = (await r.json()) as Artifact | { error: string };
          if (!data || "error" in data) break;
          nodes.unshift(data);
          parentId = data.parentIpId;
        } catch {
          break;
        }
        depth++;
      }
      if (!cancelled) setChain(nodes);
    }
    walk();
    return () => {
      cancelled = true;
    };
  }, [artifact]);

  if (chain.length === 1 && !artifact.parentIpId && !artifact.externalSource) {
    return (
      <p className="text-[12.5px] text-[var(--ov-text-dim)]">
        Original work — no upstream lineage recorded.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        {artifact.externalSource && chain.length === 1 && (
          <>
            <OssNode source={artifact.externalSource} />
            <Edge label="provenance" />
          </>
        )}
        {chain.map((node, i) => {
          const isCurrent = node.ipId === artifact.ipId;
          return (
            <div key={node.ipId} className="flex items-center gap-2">
              <LineageNode node={node} current={isCurrent} />
              {i < chain.length - 1 && (
                <Edge
                  label={
                    chain[i + 1].licenseTermsId
                      ? `terms ${chain[i + 1].licenseTermsId}`
                      : "derivative"
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--ov-text-faint)]">
        <FlowIcon />
        Royalties route upstream per each link&apos;s license terms.
      </p>
    </div>
  );
}

function LineageNode({
  node,
  current,
}: {
  node: Artifact;
  current: boolean;
}) {
  const meta = tierMeta(node.tier);
  return (
    <div
      className="min-w-[180px] rounded-xl border p-3"
      style={{
        borderColor: current
          ? `color-mix(in oklab, ${meta.color} 55%, var(--ov-line))`
          : "var(--ov-line)",
        background: current
          ? `color-mix(in oklab, ${meta.color} 10%, var(--ov-panel))`
          : "color-mix(in oklab, var(--ov-panel) 70%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: meta.color }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
        {current && (
          <span className="ml-auto rounded-full bg-[var(--ov-line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--ov-text-faint)]">
            this
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-[12.5px] font-medium text-[var(--ov-text)]">
        {node.title}
      </p>
      <div className="mt-2">
        <TxLink ipId={node.ipId} />
      </div>
    </div>
  );
}

function OssNode({ source }: { source: string }) {
  return (
    <div className="min-w-[180px] rounded-xl border border-dashed border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/50 p-3">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-text-faint)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
          OSS source
        </span>
      </div>
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 line-clamp-1 block text-[12px] text-[var(--ov-accent)] underline-offset-2 hover:underline"
      >
        {source}
      </a>
    </div>
  );
}

function Edge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 px-1 text-[var(--ov-text-faint)]">
      <span className="hidden text-[10px] uppercase tracking-wider sm:inline">
        {label}
      </span>
      <svg width="20" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="rotate-90 sm:rotate-0">
        <path d="M2 7h18M15 2l5 5-5 5" />
      </svg>
    </div>
  );
}

function FlowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ov-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
