"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Artifact, Modality, Tier } from "@/types/artifact";
import ModelCard from "@/components/ModelCard";
import Dropdown from "@/components/ui/Dropdown";
import Spinner from "@/components/ui/Spinner";
import Icon from "@/components/ui/Icon";

type TierOpt = Tier | "all";
type ModalityOpt = Modality | "all";
type SortOpt = "relevance" | "newest" | "score";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div
          className="container maxw-browse"
          style={{ paddingTop: 60, textAlign: "center" }}
        >
          <Spinner lg />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hydrate initial state from the URL so /search?q=…&tier=… is shareable.
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [tier, setTier] = useState<TierOpt>(
    () => (searchParams.get("tier") as TierOpt) ?? "all",
  );
  const [modality, setModality] = useState<ModalityOpt>(
    () => (searchParams.get("modality") as ModalityOpt) ?? "all",
  );
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? "");
  const [sort, setSort] = useState<SortOpt>(
    () => (searchParams.get("sort") as SortOpt) ?? "relevance",
  );

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep the URL in sync with the active facets.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (tier !== "all") sp.set("tier", tier);
    if (modality !== "all") sp.set("modality", modality);
    if (tag.trim()) sp.set("tag", tag.trim());
    if (sort !== "relevance") sp.set("sort", sort);
    const qs = sp.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }, [q, tier, modality, tag, sort, router]);

  // Fetch results from the real index whenever a facet changes.
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (tier !== "all") params.set("tier", tier);
    if (modality !== "all") params.set("modality", modality);
    if (tag.trim()) params.set("tag", tag.trim());
    if (sort !== "relevance") params.set("sort", sort);

    setLoading(true);
    fetch(`/api/index?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Artifact[]) => {
        if (Array.isArray(data)) setArtifacts(data);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setArtifacts([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [q, tier, modality, tag, sort]);

  const clear = useCallback(() => {
    setQ("");
    setTier("all");
    setModality("all");
    setTag("");
    setSort("relevance");
  }, []);

  const active =
    q.trim() !== "" ||
    tier !== "all" ||
    modality !== "all" ||
    tag.trim() !== "" ||
    sort !== "relevance";

  return (
    <div
      className="container maxw-browse"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      <div className="anim-up" style={{ marginBottom: 18 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          SEARCH THE VAULT
        </p>
        <h1 className="h1" style={{ margin: 0, color: "var(--ov-text)" }}>
          Faceted search
        </h1>
      </div>

      {/* facet bar */}
      <div
        className="panel"
        style={{
          padding: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ov-text-faint)",
              display: "inline-flex",
            }}
          >
            <Icon name="search" size={15} />
          </span>
          <input
            className="input"
            placeholder="Search title, tags, description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", paddingLeft: 33, fontSize: 12.5 }}
          />
        </div>

        <input
          className="input"
          placeholder="Tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          style={{ width: 150, fontSize: 12.5 }}
        />

        <Dropdown<TierOpt>
          value={tier}
          onChange={setTier}
          minWidth={140}
          options={[
            { value: "all", label: "All tiers" },
            { value: "public", label: "Public" },
            { value: "gated", label: "Gated" },
            { value: "compute", label: "Compute" },
            { value: "group", label: "Group" },
            { value: "private", label: "Private" },
          ]}
        />

        <Dropdown<ModalityOpt>
          value={modality}
          onChange={setModality}
          minWidth={150}
          options={[
            { value: "all", label: "All modalities" },
            { value: "dataset", label: "Datasets" },
            { value: "model", label: "Models" },
          ]}
        />

        <Dropdown<SortOpt>
          value={sort}
          onChange={setSort}
          minWidth={140}
          align="right"
          options={[
            { value: "relevance", label: "Relevance" },
            { value: "newest", label: "Newest" },
            { value: "score", label: "Top score" },
          ]}
        />

        {active ? (
          <button type="button" className="btn btn-ghost" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>

      <div
        className="meta"
        style={{ margin: "0 0 14px", color: "var(--ov-text-faint)" }}
      >
        {loading
          ? "SEARCHING…"
          : `${artifacts.length} RESULT${artifacts.length === 1 ? "" : "S"}`}
      </div>

      {loading ? (
        <div className="ov-grid">
          {Array.from({ length: 6 }).map((_, i) => (
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
            {active
              ? "No artifacts match these filters."
              : "Start typing or pick a facet to search the index."}
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
