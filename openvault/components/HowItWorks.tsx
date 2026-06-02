import Icon, { type IconName } from "@/components/ui/Icon";

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

/** "How it works" explainer — the unique content folded in from the old
 *  /about page. Self-contained, no props. Rendered on the landing page below
 *  the artifact grid. */
export default function HowItWorks() {
  return (
    <section className="anim-up" style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          HOW IT WORKS
        </p>
        <h2
          className="font-display"
          style={{
            margin: "0 auto",
            maxWidth: 640,
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "var(--ov-text)",
          }}
        >
          Confidential data, permissioned on-chain
        </h2>
      </div>
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
  );
}

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
