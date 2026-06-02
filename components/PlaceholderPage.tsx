/** Minimal "coming soon" scaffold so nav links never 404. */
export default function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="container maxw-artifact"
      style={{
        minHeight: "55vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        className="anim-up"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span className="eyebrow" style={{ color: "var(--ov-accent)" }}>
          {eyebrow}
        </span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px,4vw,38px)",
            color: "var(--ov-text)",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            maxWidth: 440,
            color: "var(--ov-text-dim)",
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
