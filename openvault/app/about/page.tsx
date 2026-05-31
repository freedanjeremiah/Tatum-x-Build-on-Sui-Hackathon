import Link from "next/link";
import VaultMark from "@/components/ui/VaultMark";
import Icon, { type IconName } from "@/components/ui/Icon";

export const metadata = {
  title: "About — OpenVault",
  description:
    "Access control as a property of the data: Story IP Assets, threshold encryption via CDR, IPFS storage, and on-chain access tiers.",
};

/** Static MECHATONE landing — real copy only, no fabricated stats. */
export default function AboutPage() {
  return (
    <div
      className="container maxw-leaderboard"
      style={{ paddingTop: 40, paddingBottom: 72 }}
    >
      {/* hero */}
      <section className="anim-up" style={{ marginBottom: 56 }}>
        <span
          className="eyebrow"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <VaultMark size={20} />
          OPENVAULT
        </span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(30px,5vw,52px)",
            lineHeight: 1.05,
            margin: "16px 0 18px",
            maxWidth: 760,
            color: "var(--ov-text)",
          }}
        >
          Access control as a property of the data
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 620,
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--ov-text-dim)",
          }}
        >
          OpenVault registers datasets and models as Story IP Assets, seals the
          payload with threshold encryption, and pins it to IPFS. Who can read
          the bytes is decided on-chain — not by a server you have to trust. The
          permission travels with the artifact.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 30,
          }}
        >
          <Link href="/" className="btn btn-accent">
            <Icon name="search" size={14} />
            Browse the vault
          </Link>
          <Link href="/upload" className="btn btn-navy">
            <Icon name="upload" size={14} />
            Register an artifact
          </Link>
          <Link href="/search" className="btn btn-ghost">
            <Icon name="search" size={14} />
            Search
          </Link>
        </div>
      </section>

      {/* pillars */}
      <section className="anim-up">
        <p className="eyebrow" style={{ marginBottom: 16 }}>
          HOW IT WORKS
        </p>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))",
          }}
        >
          {PILLARS.map((p) => (
            <Pillar key={p.title} {...p} />
          ))}
        </div>
      </section>
    </div>
  );
}

type PillarDef = {
  icon: IconName;
  title: string;
  body: string;
};

const PILLARS: PillarDef[] = [
  {
    icon: "vault",
    title: "Story IP Assets",
    body: "Every dataset or model is registered on Story Protocol (Aeneid) as an IP Asset with on-chain provenance and a registration transaction you can verify.",
  },
  {
    icon: "shield",
    title: "Threshold encryption via CDR",
    body: "Payloads are sealed with the CDR threshold scheme. No single party holds the key — decryption requires the on-chain read condition to be satisfied.",
  },
  {
    icon: "layers",
    title: "IPFS storage",
    body: "Encrypted bytes and metadata are pinned to IPFS and addressed by CID, so the artifact is content-addressed and portable rather than locked in one host.",
  },
  {
    icon: "key",
    title: "On-chain access tiers",
    body: "Public, gated, private, group, and compute tiers map to read conditions enforced by contract. Gated access is unlocked by minting a license token; compute-tier vaults are computable but never downloadable.",
  },
];

function Pillar({ icon, title, body }: PillarDef) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "var(--ov-panel-2)",
          color: "var(--ov-accent)",
          marginBottom: 14,
        }}
      >
        <Icon name={icon} size={18} />
      </span>
      <h2
        className="font-display"
        style={{
          margin: "0 0 8px",
          fontSize: 17,
          fontWeight: 600,
          color: "var(--ov-text)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--ov-text-dim)",
        }}
      >
        {body}
      </p>
    </div>
  );
}
