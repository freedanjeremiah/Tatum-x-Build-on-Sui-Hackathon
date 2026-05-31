"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import TxLink from "./TxLink";
import Icon from "./ui/Icon";
import { ModalityChip, TierBadge, TierGlyph } from "./ui/TierBadge";

function ctaLabel(a: Artifact): string {
  switch (a.tier) {
    case "gated":
      return "Mint to unlock";
    case "compute":
      return "Run a job";
    case "public":
      return "Download";
    case "group":
      return "View group";
    case "private":
    default:
      return "Owner only";
  }
}

function licenseSummary(a: Artifact): string {
  if (a.computeEnabled) return "Compute license · pay per job";
  if (a.tier === "gated") return "Commercial · mint to unlock";
  if (a.tier === "group") return "Group license · subscribe";
  if (a.tier === "private") return "Owner only";
  if (a.licenseTermsId) return "Commercial · license attached";
  return "Provenance on-chain";
}

function ctaHref(a: Artifact): string {
  if (a.tier === "compute") return `/compute/${a.ipId}`;
  if (a.tier === "group" && a.groupId) return `/group/${a.groupId}`;
  return `/artifact/${a.ipId}`;
}

export default function ModelCard({ artifact: a }: { artifact: Artifact }) {
  const router = useRouter();
  const t = tierMeta(a.tier);
  const [hover, setHover] = useState(false);
  const isPrivate = a.tier === "private";
  const detailHref = `/artifact/${a.ipId}`;

  function openDetail() {
    router.push(detailHref);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={a.title}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="anim-up"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        textAlign: "left",
        cursor: "pointer",
        background: "var(--ov-panel)",
        border: "1.5px solid var(--ov-line-ink)",
        borderRadius: "var(--radius-xl)",
        transition: "transform .16s ease, box-shadow .16s ease",
        transform: hover ? "translate(-2px,-3px)" : "none",
        boxShadow: hover
          ? `6px 8px 0 ${t.color}`
          : "3px 4px 0 rgba(33,53,108,0.14)",
      }}
    >
      {/* tier tab — top edge */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          height: 4,
          background: t.color,
        }}
      />

      {/* header zone */}
      <div
        style={{
          position: "relative",
          padding: "18px 16px 0",
          overflow: "hidden",
        }}
      >
        {/* halftone print corner */}
        <span
          aria-hidden
          className="halftone-dots"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 132,
            height: 104,
            color: t.color,
            opacity: 0.18,
            pointerEvents: "none",
            WebkitMaskImage:
              "radial-gradient(circle at 100% 0, #000, transparent 72%)",
            maskImage:
              "radial-gradient(circle at 100% 0, #000, transparent 72%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TierBadge tier={a.tier} />
          <ModalityChip modality={a.modality} />
          <span style={{ flex: 1 }} />
          <span
            title="Report"
            style={{
              color: "var(--ov-text-faint)",
              opacity: hover ? 1 : 0,
              transition: "opacity .15s",
              display: "inline-flex",
            }}
          >
            <Icon name="flag" size={14} />
          </span>
        </div>

        <h3
          className="font-display clamp-2"
          style={{
            position: "relative",
            fontSize: 19,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.005em",
            margin: "14px 0 8px",
            lineHeight: 1.04,
            minHeight: 40,
            color: "var(--ov-text)",
          }}
        >
          {a.title}
        </h3>
        <p
          className="clamp-2"
          style={{
            position: "relative",
            fontSize: 12.5,
            color: "var(--ov-text-dim)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {a.description}
        </p>

        {a.tags?.length ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              marginTop: 13,
            }}
          >
            {a.tags.slice(0, 4).map((tg) => (
              <Link
                key={tg}
                href={`/tags/${encodeURIComponent(tg)}`}
                onClick={(e) => e.stopPropagation()}
                className="tag-chip"
                style={{ textDecoration: "none" }}
              >
                {tg}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {a.tier === "compute" ? (
        <div
          style={{
            margin: "13px 16px 0",
            padding: "7px 11px",
            borderRadius: 8,
            fontSize: 10.5,
            color: t.color,
            background: `color-mix(in srgb, ${t.color} 11%, transparent)`,
            border: `1px solid color-mix(in srgb, ${t.color} 35%, transparent)`,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Icon name="compute" size={12} />
          Computable · not downloadable
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 16 }} />

      {/* footer / action stub */}
      <div
        style={{
          padding: "13px 16px",
          marginTop: 14,
          borderTop: "1.5px solid var(--ov-line)",
          background: "var(--ov-panel-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            color: "var(--ov-text-dim)",
            marginBottom: 12,
          }}
        >
          <TierGlyph tier={a.tier} size={13} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              fontSize: 10,
            }}
          >
            {licenseSummary(a)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TxLink ipId={a.ipId} />
          <span style={{ flex: 1 }} />
          <Link
            href={ctaHref(a)}
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 13px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              flexShrink: 0,
              background: isPrivate ? "transparent" : t.color,
              color: isPrivate ? "var(--ov-text-faint)" : "#fff",
              border: isPrivate
                ? "1.5px solid var(--ov-line)"
                : `1.5px solid ${t.color}`,
              boxShadow: isPrivate ? "none" : "2px 2px 0 var(--ov-navy)",
              transform: hover && !isPrivate ? "translate(-1px,-1px)" : "none",
              transition: "transform .14s",
            }}
          >
            {ctaLabel(a)}
            {!isPrivate ? <Icon name="arrow" size={13} /> : null}
          </Link>
        </div>
      </div>
    </div>
  );
}
