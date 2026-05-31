import Link from "next/link";
import VaultMark from "@/components/ui/VaultMark";
import Icon from "@/components/ui/Icon";

/** Branded 404 — replaces the Next.js default not-found page. */
export default function NotFound() {
  return (
    <div
      className="container maxw-upload"
      style={{
        paddingTop: 80,
        paddingBottom: 80,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="panel anim-up"
        style={{
          padding: "40px 32px",
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <VaultMark size={44} />
        <div>
          <p
            className="eyebrow"
            style={{ marginBottom: 8, justifyContent: "center" }}
          >
            ERROR
          </p>
          <h1
            className="h1"
            style={{ fontSize: 28, margin: 0, color: "var(--ov-text)" }}
          >
            404 — not found
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ov-text-dim)",
            maxWidth: 360,
          }}
        >
          That page, artifact, or route isn&apos;t in the vault. It may have
          never existed or the address is mistyped.
        </p>
        <Link href="/" className="btn btn-accent">
          <Icon name="search" size={14} />
          Back to Browse
        </Link>
      </div>
    </div>
  );
}
