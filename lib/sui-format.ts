// Shared SUI ↔ MIST formatting helpers (9 decimals).
//
// On Sui all on-chain amounts are bigint MIST (1 SUI = 1e9 MIST). The migrated
// lib APIs (royalty/licensing) take and return bigint MIST directly — there is
// no viem parseEther/formatEther. These two helpers are the ONE place the UI
// converts between a human "1.25" SUI string and bigint MIST. No external deps.

/** Number of decimal places in 1 SUI. */
export const SUI_DECIMALS = 9;

const MIST_PER_SUI = 1_000_000_000n; // 10n ** 9n

/**
 * Format a bigint MIST amount as a human SUI string (up to 9 decimals, trailing
 * zeros trimmed). `formatSui(1_250_000_000n) === "1.25"`. Never throws.
 */
export function formatSui(mist: bigint): string {
  const neg = mist < 0n;
  const abs = neg ? -mist : mist;
  const whole = abs / MIST_PER_SUI;
  const frac = abs % MIST_PER_SUI;
  let out: string;
  if (frac === 0n) {
    out = whole.toString();
  } else {
    const fracStr = frac.toString().padStart(SUI_DECIMALS, "0").replace(/0+$/, "");
    out = `${whole.toString()}.${fracStr}`;
  }
  return neg ? `-${out}` : out;
}

/**
 * Parse a human SUI string ("1.25") into bigint MIST. Throws on an invalid /
 * negative / over-precise input so callers surface an honest error instead of
 * silently truncating. `parseSui("1.25") === 1_250_000_000n`.
 */
export function parseSui(s: string): bigint {
  const trimmed = (s ?? "").trim();
  if (trimmed === "") throw new Error("Enter a SUI amount.");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid SUI amount: "${s}"`);
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (fracPart.length > SUI_DECIMALS) {
    throw new Error(`Too many decimals — SUI has at most ${SUI_DECIMALS}.`);
  }
  const fracPadded = fracPart.padEnd(SUI_DECIMALS, "0");
  return BigInt(wholePart) * MIST_PER_SUI + BigInt(fracPadded || "0");
}
