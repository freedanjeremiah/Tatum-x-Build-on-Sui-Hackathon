"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import ModelCard from "@/components/ModelCard";
import Icon from "@/components/ui/Icon";

export default function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: rawTag } = use(params);
  const tag = decodeURIComponent(rawTag);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/index?tag=${encodeURIComponent(tag)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: Artifact[]) => {
        if (Array.isArray(data)) setArtifacts(data);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setArtifacts([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tag]);

  return (
    <div
      className="container maxw-browse"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <Link href="/" style={{ color: "var(--ov-text-faint)" }}>
          Browse
        </Link>{" "}
        / tags
      </div>

      <div className="anim-up" style={{ marginBottom: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          TAG
        </p>
        <h1
          className="h1 font-mono"
          style={{ margin: 0, color: "var(--ov-text)" }}
        >
          #{tag}
        </h1>
        <div
          className="meta"
          style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
        >
          {loading
            ? "LOADING…"
            : `${artifacts.length} ARTIFACT${artifacts.length === 1 ? "" : "S"}`}
        </div>
      </div>

      {loading ? (
        <div className="ov-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 256, borderRadius: 18 }}
            />
          ))}
        </div>
      ) : artifacts.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--ov-line-ink)",
            borderRadius: 18,
            padding: "52px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            background: "color-mix(in srgb, var(--ov-panel) 50%, transparent)",
          }}
        >
          <span style={{ color: "var(--ov-text-faint)" }}>
            <Icon name="search" size={30} />
          </span>
          <p
            style={{
              margin: 0,
              color: "var(--ov-text-dim)",
              fontSize: 13,
              maxWidth: 380,
            }}
          >
            No artifacts tagged {tag}.
          </p>
        </div>
      ) : (
        <div className="ov-grid">
          {artifacts.map((a) => (
            <ModelCard key={a.ipId} artifact={a} />
          ))}
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
