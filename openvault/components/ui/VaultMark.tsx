import Icon from "./Icon";

/** Brand mark — navy padlock with offset orange shadow. */
export default function VaultMark({ size = 30 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--ov-navy)",
        color: "var(--ov-accent-ink)",
        borderRadius: 8,
        boxShadow: "2px 2px 0 var(--ov-accent)",
      }}
    >
      <Icon name="vault" size={Math.round(size * 0.62)} />
    </span>
  );
}
