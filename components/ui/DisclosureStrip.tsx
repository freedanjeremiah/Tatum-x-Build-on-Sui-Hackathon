import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

type Tone = "success" | "public" | "compute" | "warning" | "gated";

const TONE_COLOR: Record<Tone, string> = {
  success: "var(--ov-navy)",
  public: "var(--ov-navy)",
  compute: "var(--ov-navy)",
  warning: "var(--ov-accent)",
  gated: "var(--ov-accent)",
};

/**
 * Reusable §8 honest-disclosure callout. Navy strip for technical /
 * informational disclosures; orange strip for warnings / gated states.
 */
export default function DisclosureStrip({
  tone = "public",
  icon = "shield",
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "11px 13px",
        borderRadius: 12,
        alignItems: "flex-start",
        color: "var(--ov-text-dim)",
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color, flex: "none", marginTop: 1 }}>
        <Icon name={icon} size={15} />
      </span>
      <div>{children}</div>
    </div>
  );
}
