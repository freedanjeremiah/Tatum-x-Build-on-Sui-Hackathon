# OpenVault — Frontend PRD

> **Note (2026-06-03):** §3 (Design system) was rewritten for the **MECHATONE
> reskin** — warm cream paper, navy + orange-red 2-ink palette, Oswald display
> + DM Sans + JetBrains Mono + Noto Sans JP, halftone-dot background, offset
> screenprint shadows. The previous dark "deep ink + emerald" aesthetic is
> retired. §1, §2 (intent/voice) and §4+ (behaviour) are unchanged.

A self-contained design brief for OpenVault's web frontend. Hand this document
to Claude (or any designer) as the source of truth for what to build, how it
should feel, and which screens/components exist today. The goal is design
fidelity that matches the product thesis without inventing flows that the
backend can't support.

---

## 1. Product, in one breath

> **A decentralized Hugging Face + Kaggle where access control is a property of
> the data, not the platform.**

- Datasets and ML models are registered as Story Protocol IP Assets on Aeneid
  testnet (chain 1315).
- Heavy bytes are threshold-encrypted on IPFS via CDR (Confidential Data
  Registry).
- The license token *is* the decryption credential — there is no auth server.
- Tier (Public / Private / Gated / Group / Compute) is enforced on-chain.

If a design choice ever obscures any of those four lines, it is wrong.

---

## 2. Audience & emotional target

**Audience.** ML researchers, dataset owners, and protocol-curious devs who
have used Hugging Face / Kaggle and want strong on-chain provenance + license
control without giving up the "browse, read a model card, take action" flow
they already know.

**Feel — MECHATONE.** A cryptographic vault meets a model hub, rendered as a
screenprinted poster.

- Calm, technical, confident. Not hype.
- Dense data is fine, but always organised — monospace for hashes/IDs,
  condensed display type for headings, proportional sans for prose.
- A faint navy halftone-dot field behind the page, warm cream background, a
  single orange-red accent. Color is information, not decoration — tiers are
  distinguished by **glyph + label** first, not by competing hues.
- Every panel and CTA gets a 3px navy offset shadow — the print-press feel.
- Every transaction surfaces *both* the IP id and the tx hash. Never hide what
  the chain saw.

**Voice.**
- Plain English, short sentences.
- Honest disclosure beats polish. The compute worker says "plain server
  (operator-trusted, demo)" because that's true; production would say
  "attested SGX/TDX enclave." Designs must preserve those disclosures.

---

## 3. Design system

### 3.1 Color tokens (single source of truth — `app/globals.css`, mirrored in `lib/tiers.ts`)

| Token | Value | Used for |
|---|---|---|
| `--ov-bg` | `#f4ead0` | Warm cream paper — app background |
| `--ov-bg-2` | `#efe2c1` | Deeper paper band (footer, scrollbar track) |
| `--ov-bg-elev` | `#ece0bd` | Inset input / field background |
| `--ov-panel` | `#f8f0d9` | Cards, surfaces |
| `--ov-panel-2` | `#f1e6c8` | Hover / secondary surface |
| `--ov-line` | `rgba(33,53,108,0.22)` | Soft border |
| `--ov-line-soft` | `rgba(33,53,108,0.12)` | Subtle dividers |
| `--ov-line-ink` | `#21356c` | Bold structural outline |
| `--ov-text` | `#21356c` | Primary text (deep navy) |
| `--ov-text-dim` | `#4f5f88` | Secondary text |
| `--ov-text-faint` | `#8b93a9` | Tertiary / metadata |
| `--ov-navy` | `#21356c` | Brand ink — panel borders, dark CTAs |
| `--ov-navy-deep` | `#182a57` | Hover state for navy |
| `--ov-accent` | `#e8472b` | Orange-red — primary CTA / brand |
| `--ov-accent-deep` | `#cf3a20` | Hover state for accent |
| `--ov-accent-ink` | `#faf3df` | Cream-on-accent text |

**Tier colors (restrained 2-ink + slate — tiers told apart by glyph + label first):**

| Tier | Token | Hex | Glyph | Mood |
|---|---|---|---|---|
| Public  | `--tier-public`  | `#e8472b` | arrow   | Open / take it |
| Private | `--tier-private` | `#7d8aa0` | lock    | Locked / personal |
| Gated   | `--tier-gated`   | `#21356c` | lock    | Licensed / paid |
| Group   | `--tier-group`   | `#21356c` | layers  | Shared / pool |
| Compute | `--tier-compute` | `#21356c` | compute | Computable, not downloadable |

The background uses two soft radial blooms (`--ov-accent` at 10% top-right,
`--ov-navy` at 10% top-left) over `--ov-bg`. A 9px halftone-dot field
(`radial-gradient` in `--ov-navy` @ 16%) sits behind everything, masked to fade
out 720px down from the top (replaces the original engineering grid).

### 3.2 Typography

- **Display** (`--font-display`): `Oswald` — uppercase, tight tracking. Used
  for `.h1`, `.h2`, card titles, brand wordmark.
- **Sans** (`--font-sans`): `DM Sans` — default body text, buttons, labels.
- **Mono** (`--font-mono`): `JetBrains Mono` — **mandatory** for ipIds, tx
  hashes, CIDs, license terms ids, vault uuids, algorithm hashes, evidence
  CIDs, all `.eyebrow` / `.meta` chips, file names.
- **JP** (`--font-jp`): `Noto Sans JP` — used sparingly for the katakana
  kickers under the hero eyebrow.
- Hierarchy:
  - `.h1` page title: `clamp(34px, 5vw, 52px)`, Oswald 600, line-height 0.98,
    uppercase, slight negative tracking.
  - `.h2` section heading: 22px, Oswald 600, uppercase. Step counters in
    upload wizard use a `01` / `02` mono prefix in accent color.
  - `.eyebrow`: 10.5px mono uppercase, tracking 0.22em, `--ov-text-faint`.
  - `.meta`: 10.5px mono uppercase, tracking 0.12em, `--ov-text-faint`.
  - Body: 13–14px DM Sans, line-height 1.55.

### 3.3 Spacing & radius

- Standard radii: `rounded-md` (small chips), `rounded-lg` (inputs, secondary
  buttons), `rounded-xl` (cards, dropzones), `rounded-2xl` (panels, dialogs),
  `rounded-full` (tier chips, badges).
- Section padding: page container `max-w-[1400px]` (browse) / `max-w-4xl`
  (artifact) / `max-w-3xl` (upload) / `max-w-5xl` (leaderboard), with
  horizontal `px-5`.
- Vertical rhythm: hero `py-12`–`py-16`, section panels `p-5` (mobile) / `p-6`.

### 3.4 Motion (defined in `app/globals.css`)

- `ov-anim-up` — 7px translate up, 340ms cubic. Applied via `.anim-up` to most
  page sections, often staggered (`animationDelay: i * 45ms`, capped 300ms).
- `ov-spin` — 0.7s linear, used inside `.spinner`.
- `ov-pulse-ring` — 1.4s, used inside in-progress step dots + the dispute
  badge dot.
- `ov-shimmer` — 1.4s linear, used inside `.skeleton`.
- Hover on cards: 2-3px translate up + a tier-coloured offset shadow
  (`6px 8px 0 <tier>`). The print-press shadow grows on hover.
- Never animate the halftone field. Never bounce. No parallax.

### 3.5 Iconography

- Inline SVG only — see `components/ui/Icon.tsx`. Stroke-only,
  `strokeWidth="2"`, rounded caps and joins, 24×24 viewBox.
- Per-tier glyphs in card lock area: `arrow` for public, `lock` for
  gated/private, `compute` (grid-with-pins) for compute, `layers` for group.
- Brand mark: navy padlock-vault tile with 2px orange offset shadow
  (`components/ui/VaultMark.tsx`). Appears in the header and the WasmGate boot
  splash.

### 3.6 Component primitives reused across screens

- **TierBadge** / **TierGlyph** / **ModalityChip**
  (`components/ui/TierBadge.tsx`): pill with colored dot + uppercase tier
  label, semi-transparent fill in the tier color.
- **Icon** (`components/ui/Icon.tsx`): named-set wrapper around the inline SVG
  paths.
- **Dropdown** (`components/ui/Dropdown.tsx`): custom select with offset
  shadow popover (native `<select>` cannot be styled to match).
- **DisclosureStrip** (`components/ui/DisclosureStrip.tsx`): the reusable §8
  callout — navy tint for informational, accent tint for warnings/gated.
- **Spinner** (`components/ui/Spinner.tsx`): 14px ring border with accent on
  top, `ov-spin`.
- **VaultMark** (`components/ui/VaultMark.tsx`): brand glyph.
- **TxLink** (`components/TxLink.tsx`): mono chip linking to
  `aeneid.explorer.story.foundation/ipa/<ipId>` or
  `aeneid.storyscan.io/tx/<hash>`. Always shows the suffix tag (`IPA` or `TX`).
- **Step counter** (Upload wizard): circular numbered chip; turns into a check
  glyph when done.
- **Spinner**: 14px ring border with accent on top, `ov-spin`.
- **Field**: small uppercase label above the control, both wrapped in a
  `<label>`. Inputs use `--ov-bg-elev` background, `--ov-line` border, focus
  border `--ov-accent`.

---

## 4. Information architecture

```
/                          Browse (home)
/upload                    Register an artifact (5-step wizard)
/artifact/[ipId]           Artifact detail
/compute/[ipId]            Confidential compute panel for compute-tier IP
/group/[groupId]           Group bundle
/leaderboard               Top artifacts by score

(server-only)
/api/index                 GET: list/filter artifacts. POST: self-index.
/api/compute               POST: dispatch a confidential job to the worker.
/api/pin, /api/pin-file    POST: relay public pinning to Pinata.
```

Top nav (`Header.tsx`): Browse · Upload · Leaderboard, with active-link
underline in `--ov-accent`. Right side shows network label
(`AENEID TESTNET`, mono uppercase) and the WalletButton (Privy login).

The page wrapper (`app/layout.tsx`) mounts:
1. `<Providers>` (Privy auth provider + wallet bridge).
2. `<WasmGate>` — blocks rendering of any CDR-touching screen until the WASM
   confidential-decryption module has initialised. Shows a calm
   "Initializing secure runtime…" centered spinner.
3. `<Header>` (sticky, blur background).
4. The route's content inside `#ov-root`.
5. A globally pinned `CdrLimitsNotice` disclosure strip at the bottom.

---

## 5. Page specs

> Each page below is described as: purpose → header → main content → states →
> sidebar / extras. Color refers to the tokens above. If a screen has multiple
> states (loading, empty, error, success), every state must be designed.

### 5.1 `/` — Browse (Home)

**Purpose.** First impression + entry to every artifact. Looks like Hugging
Face's models page but technical.

**Hero** (`app/page.tsx → Hero`).
- Eyebrow chip: `STORY · CONFIDENTIAL DATA REGISTRY` (mono, accent dot).
- H1: "**Access control as a** `<span>property of the data.</span>`" — the
  second line is `--ov-accent`. Tight tracking, 4xl on sm+.
- Sub: one-liner about the thesis.
- Tier legend strip: five entries (color square + tier label + blurb).

**Filter bar** (sticky just below the header).
- Tier chips: All / Public / Gated / Compute / Group / Private. Active chip
  fills with that tier's color at ~14% opacity, border at ~45%.
- Right side: modality select (`All modalities` / `Datasets` / `Models`),
  plus a search input with a magnifier icon (filters title, tags, description
  server-side via `q=`).

**Result count line.** `N ARTIFACTS` in mono, uppercase, wide-tracking faint
text.

**Grid.** Responsive 1/2/3/4 columns (sm/lg/xl).

**Card** (`components/ModelCard.tsx`). Every card has:
- A 3px tier-colored rail on the left edge.
- Top row: TierBadge + ModalityChip + a hidden Report flag that appears on
  hover.
- Title (15px semibold) + 2-line clamped description.
- Up to 4 tags rendered as mono 10px chips.
- For compute tier only: a callout strip "Computable · not downloadable".
- Bottom row:
  - License summary line ("Commercial · mint to unlock" / "Compute license ·
    pay per job" / "Commercial · license attached"), prefixed by a lock-style
    glyph.
  - `TxLink ipId={…}` + a tier-colored CTA pill ("Mint to unlock" / "Run a
    job" / "Download" / "View group" / "Owner only").

**States.**
- *Loading:* 6 SkeletonCards (`h-64 animate-pulse` panels).
- *Empty (no filters):* dashed-border zone with magnifier glyph, "No artifacts
  published yet" + a CTA button → `/upload`.
- *Empty (filtered):* same zone, "No artifacts match these filters" + nudge to
  clear the filter.

---

### 5.2 `/upload` — Register an artifact

**Purpose.** Wizard that enforces the core invariant: **register the IP
first**, then encrypt + pin the bytes. The 5 stepper dots are not decorative
— they reflect ordering that the contract enforces.

**Page header.** Eyebrow `PUBLISH`, H1 "Register an artifact", sub describing
the order ("we register, then encrypt, your ipId exists before any byte is
uploaded").

**Stepper** (top of card).
- Steps: `Artifact` → `Details` → `Tier` → `Lineage` → `Review`.
- Each step: numbered circle (turns into a check when done) + label. A 1px
  divider line between steps.

**Step panels** (`components/UploadWizard.tsx`). All inside a rounded-2xl
panel.

1. **Artifact.** File dropzone (dashed border, upload glyph, "Choose a file" +
   instruction) + Modality toggle (`Dataset` / `Model`).
2. **Details.** Title, Description (3-row textarea), Tags (comma-separated),
   Creators (comma-separated).
3. **Tier.** A picker (`components/TierPicker.tsx`): 5 mini-cards (Public,
   Gated, Compute, Group, Private). Active card outlined + tinted in its tier
   color.
   - When Gated or Compute is selected, a 2-up sub-grid reveals "Minting fee
     (WIP)" and "Revenue share (%)".
   - When Compute is selected, an algorithm-allowlist chooser shows two
     allowed hashes (`sha256:mean-aggregate`, `sha256:logistic-regression`) as
     toggle buttons with a checkbox glyph. Below it: a one-liner reminding
     readers that compute data is never downloadable.
4. **Lineage.** Three mode chips: "Original work" (default), "Derived from
   on-platform artifact", "Derived from OSS source".
   - On-platform → a search input that queries `/api/index?q=…` and lists
     matching results with TierBadge + license terms id.
   - OSS source → `OssParentImport` panel (yellow info strip + URL / license /
     authors fields + a CTA to register the provenance parent on-chain).
   - When a parent is picked, a green confirmation strip replaces the chooser
     with `TxLink ipId={…}` and a Clear control.
5. **Review.** A `<dl>` grid of File, Modality, Title, Tier (TierBadge), Tags,
   Creators, and (for gated/compute) Fee · Rev-share, (for compute) Algorithms,
   (with parent) Derived from. Below: a 3-line clamped description and the
   submit area.

**Footer nav.** Back (text on border) on the left, Continue (filled accent) on
the right. On the Review step the CTA becomes "Register & upload" — wider,
shows a spinner + "Publishing…" while in flight, and a small progress strip
above it ("Registering IP → encrypting to license-gated vault…" /
"Indexing artifact…").

**Success screen.** Replaces the wizard entirely.
- Centered tier-colored check tile (rounded 2xl).
- H1 "Artifact registered".
- Sub: "<title> is now on-chain and {sealed in its vault | pinned in the
  clear}".
- A summary panel with TierBadge + modality, the Title row, the IP asset
  (TxLink), the Register tx (TxLink), and (if derivative) Parent IP.
- Two CTAs: "View artifact" (filled accent → `/artifact/<ipId>`) and "Back to
  browse" (outlined).

**Error states.** Friendly mapping for:
- `insufficient funds` → "Top up your wallet…"
- `user rejected | denied` → "Transaction was rejected in your wallet."
- `WalletNotConnectedError` from `lib/useClients` → its message verbatim.

---

### 5.3 `/artifact/[ipId]` — Artifact detail

**Purpose.** Hugging Face / Kaggle-style model card + provenance + action
panel + lineage graph. Now also: **royalties** for owners.

**Component.** `components/ArtifactDetail.tsx`.

**Breadcrumb.** `Browse / <modality>`.

**Header.**
- TierBadge + modality chip + (if disputed) a "In dispute #<id>" pill in
  `--tier-gated` colors with a pulsing dot.
- Top-right Report button (outlined → hover tier-gated).
- H1: artifact title (large, tight).
- Description (max-w-2xl).
- Tag chips (mono 10px on `--ov-bg-elev`).
- Divider.

**Main column.**

1. **Access panel.** Rounded-2xl, border + bg tinted in the tier color at
   30%/6%. Heading "ACCESS", short blurb. Action area:
   - For Public/Private/Gated → `DownloadButton`. Label switches per tier
     ("Download" / "Decrypt (owner)" / "Mint to unlock"). On click goes
     through a `decrypting` phase that shows `DecryptProgress`. On timeout the
     progress component flips to a soft retry CTA. Browser-downloads the
     decrypted bytes as `<slug>.bin`.
   - For Compute → a `ComputeCta` block: a tier-tinted "Computable, never
     downloadable" strip, a "Run a compute job" button → `/compute/<ipId>`,
     and a list of allowlisted algorithm hashes (mono 12px with tier dots).

2. **Lineage panel.** `components/LineageGraph.tsx` renders parent ↔ this ↔
   children boxes joined by `DERIVATIVE →` arrows. Each box shows TierBadge +
   title + IP TxLink. Highlights "THIS" in the current artifact's box.

3. **Royalty panel.** `components/RoyaltyPanel.tsx`. Shown when there is a
   `licenseTermsId`.
   - Header "ROYALTIES" with a Refresh action on the right.
   - Claimable revenue card: monospace 18px value (e.g. `0.0042 WIP`), with a
     small line "N indexed derivative route to this IP."
   - "Claim revenue (owner)" CTA (filled accent). Disabled when no indexed
     derivatives exist.
   - Divider, then "Pay royalties to this IP" sub-form: amount input + WIP
     label + "Pay royalty" outlined button. Footnote: "Auto-wraps native IP →
     WIP if needed."
   - After a tx: a green "✓ Tx confirmed" strip with a TxLink.

**Sidebar (right, fixed 280px).** PROVENANCE card with rows:
- IP asset → TxLink (ipa)
- Created → TxLink (tx)
- License terms (mono id, e.g. `2553`)
- Compute terms (when present)
- Parent IP → TxLink (ipa)
- Group → TxLink (ipa)
- OSS source → external link (truncated, accent color)

**Report dialog.** `components/ReportDialog.tsx` opens as a centered modal
(blurred backdrop):
- Eyebrow "Report artifact" + flag glyph.
- Evidence textarea.
- Evidence CID strip (mono, auto-generated fresh per open via
  `freshEvidenceCidBrowser`).
- Bond disclosure: "A bond in WIP is required to raise a dispute (read
  on-chain from the arbitration policy at submit time, auto-wrapped from
  native IP). It is returned if your report is upheld and forfeited if it is
  rejected."
- Cancel (outlined) and "Raise dispute" (filled `--tier-gated`).
- Success: replaces the form with "Dispute #N raised" strip + TxLink + Done.

---

### 5.4 `/compute/[ipId]` — Confidential compute

**Purpose.** Run an allowlisted algorithm against a compute-tier dataset
inside the worker. Receive **aggregates only**. The page must surface this
contract loudly.

**Component.** `components/ComputeJobPanel.tsx`.

**Breadcrumb.** `Browse / dataset / compute`.

**Header.** TierBadge (compute) + Modality chip + a "COMPUTABLE · NEVER
DOWNLOADABLE" callout chip in compute color. H1 = artifact title.
Below the title: `IP TxLink + Register-tx TxLink + "compute terms #2553"`
mono label.

**Two-column body.**

1. **Algorithm allowlist** (left, 1/2 width). Heading "ALGORITHM ALLOWLIST"
   with a small shield glyph. A short paragraph explaining the privacy
   boundary. Then a list of permitted algorithms — each as a panel showing
   the algo name + mono hash, with a tier-colored leading dot.

2. **Run a confidential job** (right, 1/2 width). Heading + paragraph
   explaining the worker mints one license, decrypts in-process, and returns
   aggregates only. Then:
   - Algorithm radio list (each item: filled circle when selected, name +
     mono hash).
   - Params input (optional JSON), mono.
   - "Run confidential job" CTA (filled `--tier-compute`).
   - Progress trail (visible while running): two checklist items —
     "Allowlist check + mint compute license in worker" → "Decrypt + run (no
     rows leave)". Each item has a 4px tier-colored ring; the active one
     pulses, completed ones fill.

**Done state.**
- Tier-colored "Job complete — results only" line with a check glyph.
- Metrics card: 2- or 3-up grid of `key` (mono uppercase 10px) over `value`
  (mono 14px).
- Rows: Result IP (derivative TxLink), Registration tx (TxLink), Compute
  license token (mono id), optional Metrics URI.
- "The result is registered as a derivative … so royalties flow upstream.
  No raw rows were returned."
- Warning strip (`⚠ <warning>`) only when present.
- Isolation disclosure (always at the bottom of the panel, tier-gated tinted):
  "This demo worker runs on a plain server — the operator can see plaintext
  in memory. A production deployment would run in an attested SGX/TDX
  enclave."

**Rejected state.** A `--tier-gated` panel: "Rejected by the worker" + reason
+ a mono footnote `decryptCalled: false — no decryption was performed.`

**Error state.** Same gated-color strip with the error message.

**Idle.** Always show the isolation disclosure even before running. Honest
disclosure is part of the brand.

---

### 5.5 `/group/[groupId]` — Group bundle

**Purpose.** Show a group artifact, its member IPs, and (eventually) a single
group-license subscribe action. The current implementation is honest about
the open spec item: one group license unlocking every member's vault is not
yet confirmed in CDR, so members are still gated per-IP.

**Component.** `app/group/[groupId]/page.tsx`.

**Header.** Eyebrow `Group` chip, H1 = group title, description. Provenance
sidebar similar to artifact detail, plus a Group TxLink.

**Member grid.** Same `ModelCard` used in Browse, filtered to members whose
`groupId` matches.

**Subscribe CTA.** "Subscribe to unlock family" — large filled accent button
in the access panel. Today this opens a stub explanation; design should
treat it as the final shape of the action even while the contract path is
not wired.

**Open-item disclosure.** A `--tier-gated` strip at the bottom of the access
panel: "SPEC §8.7 — group license → member-vault unlock is unconfirmed in
CDR; per-IP gating fallback applied."

**Empty / 404.** When the group id doesn't resolve: a centered "No group
with that ID" zone + the mono group id + a Back to browse button.

---

### 5.6 `/leaderboard` — Top artifacts by score

**Purpose.** Kaggle-style ranking by on-chain usage score. Score is a public
index metric (tier-weighted baseline + derivative-count bumps): the page must
make clear it is public metadata, not a leaderboard of secrets.

**Component.** `app/leaderboard/page.tsx`.

**Header.** Eyebrow `🏆 LEADERBOARD`, H1 "Top artifacts by score", sub:
"Datasets and models ranked by their on-chain usage score. Scores are public
index metadata; click any IP id to verify provenance."

**Table.** Wide rounded-2xl panel with a header row (10px uppercase mono
tracking-wider): `# · Title · Modality · Tier · Score · IP asset`.
- Rank cell uses a `RankBadge`: medal-colored chips for top 3 (gold / silver
  / bronze), mono numeral after.
- Title links to `/artifact/<ipId>` (accent on hover).
- Modality and TierBadge.
- Score in mono, right-aligned, with `tabular-nums`.
- IP asset cell shows `TxLink ipId={…}`, right-aligned.

**Loading.** 6 skeleton rows.

**Empty.** "No ranked artifacts yet." centered.

---

### 5.7 Auth surfaces (`Header`, Privy)

- `WalletButton` (entry in header):
  - **Logged out:** filled accent "Connect" pill, small key glyph.
  - **Logged in:** wallet address truncated as `0x29bc…3C50`, mono. Click to
    open a dropdown: address (copyable), explorer link, Disconnect.
- Login modal is the Privy default — design only the trigger and the
  in-product confirmation strip after success ("✓ Connected as 0x29bc…3C50").

---

### 5.8 Global notice — `CdrLimitsNotice`

A persistent collapsible strip at the bottom of every page that reminds users
of the spec disclosures (no decryption revocation, plain-server worker, group
member unlock unconfirmed). Default collapsed; clicking the chevron expands a
panel of three bulleted disclosures with their relevant spec references.

---

## 6. Cross-cutting components

| Component | Purpose | Where used |
|---|---|---|
| `Header` | Sticky nav + wallet entry + network label | global |
| `WalletButton` / `WalletButtonPrivy` | Privy connect + post-login chip | header |
| `PrivyAuthProvider` / `Providers` | Privy context + wallet bridge | layout |
| `WasmGate` | Blocks CDR-touching screens until WASM ready | layout |
| `WalletBridge` | Surfaces the active EIP-1193 provider to `lib/useClients` | layout |
| `ModelCard` + `TierBadge` | Browse card + reusable tier pill | Browse, search |
| `TierPicker` | 5-up tier chooser cards | Upload |
| `AlgoAllowlist` | Read-only display of allowed algorithms | Compute detail |
| `UploadWizard` | 5-step register-and-upload flow | `/upload` |
| `OssParentImport` | Register a provenance parent for OSS derivative | Upload (lineage step) |
| `ArtifactDetail` | Detail page composition | `/artifact/[ipId]` |
| `DownloadButton` | Tier-aware download/decrypt action | Artifact detail |
| `DecryptProgress` | In-progress / timed-out strip with retry | Download flow |
| `ComputeJobPanel` | Allowlist + run + result viewer | `/compute/[ipId]` |
| `LineageGraph` | Parent ↔ This ↔ Children boxes with arrows | Artifact detail |
| `RoyaltyPanel` | Claimable read + claim + pay-royalty form | Artifact detail |
| `ReportDialog` | Raise a dispute modal | Artifact detail |
| `TxLink` | Mono chip → IPA / TX explorer | everywhere |
| `CdrLimitsNotice` | Persistent disclosure footer | layout |
| `PlaceholderPage` | "Coming soon" scaffold (used sparingly) | optional routes |

---

## 7. Data + state contracts the design must respect

- **`Artifact`** is the canonical record (`types/artifact.ts`). Every screen
  reads from `/api/index` GET. Fields a designer cares about:
  `ipId, tier, modality, title, description, tags, ipMetadataURI, vaultUuid,
  cid, licenseTermsId, parentIpId, groupId, createdTx, computeEnabled,
  allowedAlgoHashes, computeLicenseTermsId, externalSource, score`.
- **`ComputeJobResult`** (`types/artifact.ts`) drives the Compute panel's
  done/rejected/failed states: `status, metrics, resultIpId, resultTx,
  isolationMode, decryptCalled, scratchCleared, licenseTokenId, warning,
  reason`.
- **Tiers in `lib/tiers.ts`** are the only place to read tier label/color/blurb
  from. Designs must not redefine them.
- **Real-only.** There is no mock mode anymore. Empty states must be
  designed assuming a fresh testnet vault — no fake artifacts.

---

## 8. Honest-disclosure invariants (design must preserve)

These are non-negotiable copy + visibility rules. Any redesign must keep them
visible to the user at the exact moment they matter.

1. **Compute is plain-server.** Every compute screen shows the isolation
   disclosure: "plain server (operator-trusted, demo) — production would
   attest SGX/TDX". Cannot be hidden in a tooltip.
2. **No download for compute artifacts.** The compute card surfaces
   "Computable · not downloadable" in the tier color. The artifact detail
   page shows the same. The wizard explains it during tier pick.
3. **Decryption is irrevocable.** The `CdrLimitsNotice` surfaces "CDR has no
   decryption revocation" — rotate by re-encrypting.
4. **Group license → member unlock is unconfirmed.** Group page shows the
   spec disclosure prominently.
5. **Provenance is always shown.** Every artifact view shows the real ipId +
   real register tx hash via `TxLink`. Off-chain claims must visually defer
   to on-chain evidence.

---

## 9. Networks, links, identifiers (visual treatment)

- Network label `AENEID TESTNET` lives only in the header right side — mono,
  uppercase, faint. The page itself never repeats it in big type.
- `ipId` truncation in chips: `0xAAAA…BBBB` (4-on-each-side). Full id is
  available via the linked explorer page.
- `tx hash` truncation: same pattern, with `TX` suffix tag.
- License terms id: render as `2553` in mono, optionally prefixed with `#`.
- Vault UUID: `5546` in mono, prefixed with `uuid:` when needed.

---

## 10. Responsive rules

- The browse grid collapses 4 → 3 → 2 → 1 at xl / lg / sm / base.
- Artifact detail collapses the sidebar under the main column below `lg`.
- Compute panel switches to single column below `md`.
- The header nav row hides the inline nav below `sm` (TODO: add a slide-out
  menu — currently it just truncates).

---

## 11. Things explicitly out of scope for the design

- Mainnet UX (this is testnet only — explorer links go to Aeneid).
- Hiding metadata; CIDs / vault uuids / license terms ids are public by
  design.
- Revoking decryption; the spec is clear that rotation is the only path.
- Building competing tier color schemes; `lib/tiers.ts` is the source.
- A full mobile redesign (responsive is required; mobile-first is not).

---

## 12. Design deliverables a designer should produce from this brief

1. **Token sheet** — Color, type, spacing, radius, motion, in Figma styles
   that map 1-to-1 to the tokens in §3.
2. **Component library** — Every component in §6 as a Figma component with
   states (default / hover / active / focused / disabled / loading / error /
   success where applicable).
3. **Screen set (light/dark? — dark only).** One frame per page in §5
   (loading + empty + populated + success/error) plus the Report dialog.
4. **Wizard storyboard** — One frame per Upload step (`artifact`, `details`,
   `tier`, `lineage`, `review`, `submitting`, `success`).
5. **Compute storyboard** — Idle, running (progress trail), done (metrics
   + derivative + license token + warning), rejected, failed.
6. **Provenance/disclosure callouts** — A small style guide showing the
   approved copy for §8 disclosures, with examples of where each appears.

When uncertain, prefer the existing implementation in
`components/ArtifactDetail.tsx`, `components/UploadWizard.tsx`, and
`components/ComputeJobPanel.tsx` — they encode the lived product behavior.

— end of PRD
