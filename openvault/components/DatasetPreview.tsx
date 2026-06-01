"use client";

// Public-artifact inline preview. For the public tier with a CID we fetch the
// payload from the IPFS gateway and render an honest, bounded preview (≤20 rows
// for tabular/JSON, a clamped text excerpt, or an image). For any encrypted tier
// — or a missing CID — we render the locked state and link to the License tab.
// Never fabricates a preview: on fetch failure we show a real error panel.

import Link from "next/link";
import { useEffect, useState } from "react";
import DisclosureStrip from "./ui/DisclosureStrip";
import Spinner from "./ui/Spinner";

// Same IPFS gateway the public download path uses (see DownloadButton).
const GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const MAX_ROWS = 20;
const MAX_TEXT = 2048;

function cidHash(cid: string): string {
  return cid.replace(/^ipfs:\/\//, "");
}

type Kind = "rows" | "text" | "image" | "none";

interface Preview {
  kind: Kind;
  columns?: string[];
  rows?: string[][];
  text?: string;
  src?: string;
  note?: string;
}

function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const split = (l: string) => l.split(",").map((c) => c.trim());
  const columns = lines.length ? split(lines[0]) : [];
  const rows = lines.slice(1, 1 + MAX_ROWS).map(split);
  return { columns, rows };
}

function tabularFromJson(value: unknown): Preview | null {
  if (Array.isArray(value) && value.length > 0) {
    const head = value.slice(0, MAX_ROWS);
    const objs = head.filter(
      (r) => r && typeof r === "object" && !Array.isArray(r),
    ) as Record<string, unknown>[];
    if (objs.length === head.length) {
      const cols = Array.from(
        objs.reduce((set, o) => {
          Object.keys(o).forEach((k) => set.add(k));
          return set;
        }, new Set<string>()),
      );
      const rows = objs.map((o) =>
        cols.map((c) => (o[c] === undefined ? "" : String(o[c]))),
      );
      return { kind: "rows", columns: cols, rows };
    }
  }
  return null;
}

async function buildPreview(cid: string): Promise<Preview> {
  const res = await fetch(`${GATEWAY}${cidHash(cid)}`);
  if (!res.ok) throw new Error(`Gateway fetch failed (${res.status})`);
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();

  if (ct.startsWith("image/")) {
    return { kind: "image", src: `${GATEWAY}${cidHash(cid)}` };
  }

  const text = await res.text();

  // JSON / JSONL
  if (ct.includes("json") || /^[\s]*[[{]/.test(text)) {
    try {
      const value = JSON.parse(text);
      const tab = tabularFromJson(value);
      if (tab) return tab;
    } catch {
      // JSONL: one JSON object per line
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsed: unknown[] = [];
      for (const l of lines.slice(0, MAX_ROWS)) {
        try {
          parsed.push(JSON.parse(l));
        } catch {
          parsed.length = 0;
          break;
        }
      }
      if (parsed.length > 0) {
        const tab = tabularFromJson(parsed);
        if (tab) return tab;
      }
    }
    // Fall through to clamped text for non-tabular JSON.
    return {
      kind: "text",
      text: text.slice(0, MAX_TEXT),
      note: text.length > MAX_TEXT ? "Truncated preview" : undefined,
    };
  }

  // CSV
  if (ct.includes("csv") || (text.includes(",") && text.includes("\n"))) {
    const { columns, rows } = parseCsv(text);
    if (columns.length > 1 && rows.length > 0) {
      return { kind: "rows", columns, rows };
    }
  }

  // Plain text / markdown
  if (ct.startsWith("text/") || text.length > 0) {
    return {
      kind: "text",
      text: text.slice(0, MAX_TEXT),
      note: text.length > MAX_TEXT ? "Truncated preview" : undefined,
    };
  }

  return { kind: "none" };
}

export default function DatasetPreview({
  tier,
  cid,
}: {
  tier: string;
  cid?: string;
}) {
  const locked = tier !== "public" || !cid;

  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "ready"; preview: Preview }
    | { phase: "error"; message: string }
  >({ phase: "idle" });

  useEffect(() => {
    if (locked || !cid) return;
    let cancelled = false;
    // State updates live in a nested async fn (not the synchronous effect body)
    // so the loading reset doesn't trigger the set-state-in-effect cascade.
    const run = async () => {
      setState({ phase: "loading" });
      try {
        const preview = await buildPreview(cid);
        if (!cancelled) setState({ phase: "ready", preview });
      } catch (e: unknown) {
        if (!cancelled)
          setState({
            phase: "error",
            message: e instanceof Error ? e.message : "Preview failed.",
          });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [locked, cid]);

  if (locked) {
    return (
      <DisclosureStrip tone="gated" icon="lock">
        Preview locked — this artifact is threshold-encrypted. Mint a license
        token to unlock it.{" "}
        <Link href="../license" className="txlink" style={{ marginLeft: 4 }}>
          <span>License &amp; Access</span>
        </Link>
      </DisclosureStrip>
    );
  }

  if (state.phase === "loading" || state.phase === "idle") {
    return (
      <div
        className="panel"
        style={{
          padding: 28,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--ov-text-dim)",
          fontSize: 13,
        }}
      >
        <Spinner /> Loading preview from IPFS…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <DisclosureStrip tone="warning" icon="flag">
        Couldn&apos;t load a preview from the gateway: {state.message}. The file
        may be large, unpinned, or the gateway may be rate-limiting.
      </DisclosureStrip>
    );
  }

  const { preview } = state;

  if (preview.kind === "image") {
    return (
      <div className="panel" style={{ padding: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.src}
          alt="Artifact preview"
          style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
        />
      </div>
    );
  }

  if (preview.kind === "rows" && preview.columns && preview.rows) {
    return (
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table
          className="font-mono"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {preview.columns.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    color: "var(--ov-text-faint)",
                    borderBottom: "2px solid var(--ov-line-ink)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r, i) => (
              <tr key={i}>
                {preview.columns!.map((_, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "8px 12px",
                      color: "var(--ov-text)",
                      borderBottom: "1px solid var(--ov-line-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r[j] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div
          className="meta"
          style={{ padding: "10px 12px", color: "var(--ov-text-faint)" }}
        >
          First {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} ·
          preview only
        </div>
      </div>
    );
  }

  if (preview.kind === "text" && preview.text) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <pre
          className="font-mono"
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            color: "var(--ov-text)",
            maxHeight: 360,
            overflow: "auto",
          }}
        >
          {preview.text}
        </pre>
        {preview.note ? (
          <div
            className="meta"
            style={{ marginTop: 10, color: "var(--ov-text-faint)" }}
          >
            {preview.note}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DisclosureStrip tone="public" icon="download">
      No inline preview · download to inspect this file.
    </DisclosureStrip>
  );
}
