// Community tab — honest placeholder. There is no discussions backend in this
// prototype, so we say so plainly and show a clearly-disabled composer rather
// than fabricating threads.

export const runtime = "nodejs";

import Link from "next/link";
import DisclosureStrip from "@/components/ui/DisclosureStrip";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <DisclosureStrip tone="warning" icon="flag">
        Discussions aren&apos;t wired up yet. Community Q&amp;A and issue threads
        are planned — they need a backend this prototype doesn&apos;t have.
      </DisclosureStrip>

      <div className="panel" style={{ padding: 20, opacity: 0.6 }}>
        <div
          className="meta"
          style={{ marginBottom: 8, color: "var(--ov-text-faint)" }}
        >
          Start a discussion (disabled)
        </div>
        <textarea
          disabled
          aria-disabled="true"
          placeholder="Posting isn't available yet."
          rows={4}
          style={{
            width: "100%",
            resize: "none",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1.5px solid var(--ov-line-ink)",
            background: "var(--ov-panel-2)",
            color: "var(--ov-text-faint)",
            fontSize: 13,
            cursor: "not-allowed",
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled
          style={{ marginTop: 10, cursor: "not-allowed" }}
        >
          Post
        </button>
      </div>

      <Link href={`/artifact/${ipId}`} className="txlink" style={{ width: "fit-content" }}>
        <span>Back to the Card tab</span>
      </Link>
    </div>
  );
}
