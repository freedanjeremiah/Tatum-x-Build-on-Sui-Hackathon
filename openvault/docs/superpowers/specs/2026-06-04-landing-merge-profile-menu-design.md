# Landing merge + profile menu — design

## Goal

Two UI cleanups on the OpenVault frontend:

1. **Combine About into the landing page.** The `/about` hero duplicates the
   landing hero (same headline "Access control as a property of the data", same
   tagline). Only the 4 "HOW IT WORKS" pillars are unique. Fold those pillars
   onto the landing page below the artifact grid, then retire `/about`.
2. **Profile menu near wallet.** The wallet-gated links (Profile, My Tokens,
   New Group) currently float as flat items in the primary nav. Move them into a
   dedicated avatar-icon dropdown next to the wallet button.

## Part 1 — Combine About into landing

- **`components/HowItWorks.tsx`** (new) — extract the `PILLARS` data, the
  `Pillar` sub-component, and the "HOW IT WORKS" section wrapper out of
  `app/about/page.tsx`. Self-contained, no props.
- **`app/page.tsx`** — render `<HowItWorks />` after the artifact grid, before
  the trailing spacer. Browse stays above the fold; the explainer is a
  scroll-down section.
- **`app/about/page.tsx`** — delete.
- **`next.config.ts`** — add a `redirects()` entry: `/about` → `/` (permanent),
  so existing links and bookmarks do not 404.
- **`components/Header.tsx`** — drop `{ href: "/about", label: "About" }` from
  the `NAV` array. Resulting nav: Browse · Search · Upload · Leaderboard.

## Part 2 — Separate avatar profile menu

- **`components/ProfileMenu.tsx`** (new) — `dynamic(ssr:false)` wrapper that
  renders nothing unless `PRIVY_APP_ID` is set. Mirrors the current
  `WalletNavLinks` guard pattern.
- **`components/ProfileMenuPrivy.tsx`** (new) — avatar button plus dropdown.
  - Avatar: a deterministic gradient circle derived from the connected address
    (hash → hue), plus a chevron. No new icon dependency.
  - Dropdown items: **Profile** (`/profile/{addr}`), **My Tokens** (`/tokens`),
    **New Group** (`/group/new`).
  - Click-outside close and active-route highlight, reusing the
    `WalletButtonPrivy` interaction pattern.
  - Returns `null` until `user?.wallet?.address` is present.
- **`components/Header.tsx`** — remove `<WalletNavLinks />` from the nav; place
  `<ProfileMenu />` between the network label and `<WalletButton />`.
- **Delete** `components/WalletNavLinks.tsx` and
  `components/WalletNavLinksPrivy.tsx` — fully replaced by ProfileMenu.

### Header layout when connected

```
[Aeneid testnet]  [◉▾ avatar]  [● 0x29bC…3C50 ▾ wallet]
```

The avatar dropdown is account navigation. The wallet dropdown is unchanged
(copy address / view on explorer / disconnect).

## Edge cases

- Not connected → no avatar, only the Connect button.
- No Privy app id → neither the avatar nor wallet-gated links render; the static
  nav still works.
- Two dropdowns each own an independent click-outside ref. Opening one does not
  force-close the other — low-risk, acceptable.

## Verification

- `pnpm exec tsc --noEmit` clean.
- `pnpm build` succeeds.
- Manual: `/about` redirects to `/`; pillars render under the grid; the avatar
  menu routes to Profile / My Tokens / New Group correctly.
- No new unit tests — pure static UI, no logic branches worth covering.
