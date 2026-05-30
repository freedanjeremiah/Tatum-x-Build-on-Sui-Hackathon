# MECHATONE Reskin — Handoff

**Date:** 2026-06-03
**Status:** Shipped. The entire Next.js frontend now renders in the MECHATONE
screenprint aesthetic. Every previously-wired flow (Privy wallet, IPFS pin,
Story IP registration, CDR encrypt/decrypt, compute worker, royalties, dispute)
is preserved verbatim — only the visual layer was rewritten.

This document is the **forward-looking design system reference** for whoever
touches the frontend next. For backend / read-model gaps, see `../HANDOFF.md`.

---

## Quick visual reference

| Token | Value | Used for |
|---|---|---|
| `--ov-bg` | `#f4ead0` | Warm cream paper — app background |
| `--ov-bg-2` | `#efe2c1` | Deeper paper (footer band) |
| `--ov-bg-elev` | `#ece0bd` | Inset input/field background |
| `--ov-panel` | `#f8f0d9` | Cards / surfaces |
| `--ov-panel-2` | `#f1e6c8` | Hover / secondary surface |
| `--ov-line` | `rgba(33,53,108,0.22)` | Soft border |
| `--ov-line-soft` | `rgba(33,53,108,0.12)` | Subtle divider |
| `--ov-line-ink` | `#21356c` | Bold structural outline |
| `--ov-text` / `--ov-navy` | `#21356c` | Primary text / brand ink |
| `--ov-text-dim` | `#4f5f88` | Secondary text |
| `--ov-text-faint` | `#8b93a9` | Tertiary / metadata |
| `--ov-accent` | `#e8472b` | Orange-red — brand / CTA |
| `--ov-accent-deep` | `#cf3a20` | Accent hover |
| `--ov-accent-ink` | `#faf3df` | Cream-on-accent text |

**Tiers** (2-ink + slate — distinguished by glyph + label, not by competing hues):

| Tier | Color | Glyph |
|---|---|---|
| Public  | `#e8472b` (orange) | `arrow` |
| Private | `#7d8aa0` (slate)  | `lock` |
| Gated   | `#21356c` (navy)   | `lock` |
| Group   | `#21356c` (navy)   | `layers` |
| Compute | `#21356c` (navy)   | `compute` |

**Fonts** (loaded via `next/font/google` in `app/layout.tsx`):
- `--font-display` → Oswald (headings, brand wordmark, card titles)
- `--font-sans` → DM Sans (body, buttons, labels)
- `--font-mono` → JetBrains Mono (ipIds, tx hashes, CIDs, eyebrows, meta)
- `--font-jp` → Noto Sans JP (sparse katakana kickers)

**Print-press shadow.** Every primary CTA gets `3px 3px 0 var(--ov-navy)`.
Cards on hover get `6px 8px 0 <tier-color>` and translate up `(-2px, -3px)`.
Never use diffuse blur shadows — they break the aesthetic.

---

## File map

### New shared primitives (all `components/ui/`)
- `Icon.tsx` — stroke-only 24×24 SVG set. 22 named icons (lock, vault, arrow,
  compute, search, flag, check, chevron, chevronUp, key, plus, refresh,
  shield, external, copy, upload, download, trophy, close, play, bolt, layers).
- `TierBadge.tsx` — exports `TierBadge`, `TierGlyph`, `ModalityChip`. Source of
  truth for the tier pill.
- `Spinner.tsx` — 14px / 26px (lg) ring border + accent top, `ov-spin`.
- `DisclosureStrip.tsx` — reusable §8 callout. Navy tint for info/success
  tones; accent tint for warning/gated tones.
- `Dropdown.tsx` — custom select replacing native `<select>`. Offset shadow
  popover with check-marked active row.
- `VaultMark.tsx` — brand glyph (navy padlock tile, 2px orange offset shadow).

### Rebuilt (visual swap, business logic untouched)
| Component | Notes |
|---|---|
| `Header.tsx` | VaultMark + sticky nav + wallet area, active-link underline in accent |
| `WalletButton.tsx` / `WalletButtonPrivy.tsx` | Connect = `btn-accent`, post-login = `btn-ghost` with green dot + dropdown (copy / explorer / disconnect) |
| `CdrLimitsNotice.tsx` | Collapsible 3-item spec-disclosure strip (no-revoke / plain-server / §8.7) |
| `TxLink.tsx` | Mono pill, middle-truncated, with `IPA`/`TX` suffix tag |
| `ModelCard.tsx` | Tier top-bar, halftone print corner, Oswald title, ticket-stub footer with license line + TxLink + CTA pill |
| `TierPicker.tsx` | 5 mini-cards; selected card gets tier-coloured offset shadow |
| `ArtifactDetail.tsx` | breadcrumb / header / 3-section main column / sidebar provenance card |
| `DownloadButton.tsx` | Tier-coloured CTA → `DecryptProgress` → success disclosure + "Download again" |
| `DecryptProgress.tsx` | Spinner + 2-min asymptotic bar + retry on timeout |
| `LineageGraph.tsx` | Parent ↔ THIS ↔ children boxes joined by `DERIVATIVE →` arrows; uses real `/api/index` walk |
| `RoyaltyPanel.tsx` | Claimable card + claim CTA + pay form + tx confirmed disclosure |
| `ReportDialog.tsx` | Modal-backdrop centred panel, evidence textarea + CID + bond disclosure + raise btn |
| `UploadWizard.tsx` | 5-step stepper, dropzone, MECHATONE inputs, success screen — went from 1085 → 770 LOC |
| `OssParentImport.tsx` | DisclosureStrip + 3 fields + register btn → success strip |
| `AlgoAllowlist.tsx` | Allowlist panel for the compute detail sidebar |
| `ComputeJobPanel.tsx` | Algo radio + params + Run; progress trail; Done with metrics grid + result IPA + license token; Rejected with `decryptCalled: false`; isolation strip always visible |
| `WasmGate.tsx` | Boot splash uses VaultMark + Spinner + katakana caption |
| `PlaceholderPage.tsx` | Eyebrow + Oswald H1 + sub |

### Route shells
- `app/page.tsx` — Browse (Hero + FilterBar + Grid + EmptyState)
- `app/artifact/[ipId]/page.tsx` — server-side `getArtifact` + ArtifactDetail
- `app/compute/[ipId]/page.tsx` — server-side load + AlgoAllowlist + ComputeJobPanel
- `app/group/[groupId]/page.tsx` — client-side `/api/index` + AccessPanel + DistributePanel + members grid
- `app/leaderboard/page.tsx` — client-side fetch + sorted table with RankBadge medals

### Foundation
- `app/globals.css` — palette, halftone bg, full utility-class layer (`.btn*`,
  `.panel*`, `.input/.textarea`, `.tier-badge`, `.chip`, `.tag-chip`, `.txlink`,
  `.field-label`, `.h1/.h2`, `.eyebrow/.meta`, `.divider*`, `.modal-backdrop`,
  `.spinner`, `.skeleton`, `.anim-up`, grids `.ov-grid` / `.ov-detail-grid` /
  `.ov-compute-grid` / `.ov-lb-row`).
- `app/layout.tsx` — four `next/font/google` loaders (Oswald, DM Sans,
  JetBrains Mono, Noto Sans JP); `<html>` carries all four CSS variables.
- `lib/tiers.ts` — `TierMeta` now includes `glyph`, `cta`, `license` fields.

### Reference prototype
- `public/prototype/` — the original Claude-Design MECHATONE prototype as a
  hash-routed single-page React-via-Babel SPA. Once `next dev` is up, open it
  at `http://localhost:3000/prototype/OpenVault.html` for A/B visual
  comparison. ~128 KB; safe to keep checked in.

---

## How to add a new component

1. **Always reuse primitives.** Need a button? Use `.btn .btn-accent` /
   `.btn-navy` / `.btn-ghost` (`+ .btn-sm`). Need a tier pill? Import from
   `components/ui/TierBadge`. Need a disclosure strip? Use `DisclosureStrip`.
2. **Inline `style` for tier/dynamic colours, classes for everything else.**
   The prototype style is a mix of `className=` for the static utility
   classes and `style={{}}` for tier-coloured borders / backgrounds /
   shadows that have to interpolate a runtime colour.
3. **Mono for any chain artefact.** ipId, tx hash, CID, license terms id,
   vault uuid, algo hash, evidence CID, license token id. Use
   `className="font-mono"` (or `.input.mono` for inputs).
4. **Provenance is non-negotiable.** Every artifact view must surface the
   `ipId` + register tx via `<TxLink>`. Don't hide them in a hover.
5. **Honest disclosures preserved.** The compute panel must always show the
   plain-server isolation strip. The group page must always show §8.7. The
   CdrLimitsNotice footer is mounted in `layout.tsx` — don't move it.

---

## What was deliberately not changed

- `lib/*` (artifacts, royalty, dispute, useClients, group, compute) — every
  business call routes through the same lib functions as before.
- `app/api/*` — no API contract changes.
- `types/artifact.ts` — `Artifact`, `ComputeJobResult`, `Tier`, `Modality`
  shapes are identical.
- `indexer/*` — read-model + on-chain event listener untouched.
- `components/Providers.tsx` / `PrivyAuthProvider.tsx` / `WalletBridge.tsx`
  — auth + provider wiring untouched.

---

## E2E verification (last run: 2026-06-03)

Performed against `localhost:3000` (live `next dev`) via Chrome MCP.

| Surface | Result |
|---|---|
| `/` Browse | Cream bg (`rgb(244,234,208)`), DM Sans body, JetBrains Mono mono, 21 real cards, 4 distinct tier badges in grid, halftone root active |
| Filter chips | `Gated` → 2 cards, `All` clears to 21 |
| Modality dropdown | `Models` → 4 cards (all "Model" chips) |
| Search | `sent` → 1 card (SentimentLLM-7B) |
| `/upload` 5-step E2E | File set → Continue enabled → Details title/desc → Tier (Gated picked, fee/revshare available) → Lineage (3 modes) → Review (file + title + GATED visible) + `Register & upload` button present |
| `/artifact/<ipId>` | Title + ACCESS + LINEAGE + ROYALTIES + PROVENANCE sidebar render |
| Report dialog | Opens with evidence textarea + auto CID; Raise disabled until typed; Cancel closes cleanly |
| `/compute/<ipId>` | ALGORITHM ALLOWLIST + run section + isolation strip always present |
| Compute Run | Progress trail (`Allowlist check` → `Decrypt + run`) appears |
| `/leaderboard` | 22 rows (1 header + 21 ranked), trophy badges on top 3 |
| `/group/<invalid>` | "No group with that ID" empty state (real indexer has no groups yet) |
| `/artifact/<invalid>` | "ARTIFACT NOT FOUND" empty state |
| `pnpm tsc --noEmit` | Clean |
| Console | Only the existing HashPack EIP-1193 wallet provider log; **no hydration warnings introduced by the reskin** |

---

## Known follow-ups (small / cosmetic)

1. **Header mobile nav.** Below `560px` the inline nav is hidden via CSS
   (`.ov-nav { display: none !important; }`). No slide-out menu replaces it
   yet — the brand wordmark + wallet still show. Add a hamburger → drawer
   when you can.
2. **Wizard validation copy.** `canNext` is boolean only; consider per-field
   inline error text once we have real Privy login flows tested end-to-end.
3. **Royalty refresh UX.** Tapping Refresh shows "Reading…" but the absence
   of a value is rendered as `—`. Consider a one-line "Connect wallet to read"
   when `WalletNotConnectedError` fires.
4. **TierPicker tooltip.** A short hover tooltip explaining each tier's
   on-chain semantics would help first-time publishers.
5. **Print-shadow consistency.** A few `.btn-ghost` instances on dark panel
   backgrounds disappear into the navy line. Either add a subtle `0.5px`
   highlight or switch to `.btn-navy` in those spots.

---

## Reverting

If you ever need to roll back: this commit changes only visual layer files
(`app/globals.css`, `app/layout.tsx`, `lib/tiers.ts`, `components/*`, `app/**/page.tsx`)
plus adds `components/ui/` and `public/prototype/`. `git revert <commit>` is
safe and won't touch business code, types, or APIs.
