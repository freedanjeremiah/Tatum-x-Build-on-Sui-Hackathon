# OpenVault Demo Recording

Headless Playwright produces a polished MP4 walkthrough of the full OpenVault
product lifecycle against the **production** build (no compile lag on camera),
with Privy login + a funded wallet so the recording shows real on-chain
behavior.

Adapted from the [`demo-recording`](https://github.com/Philotheephilix/.claude/tree/main/skills/demo-recording)
skill.

---

## One-time prereqs

```bash
# In the openvault/ directory.
brew install ffmpeg                                       # for webm → mp4
curl -LsSf https://astral.sh/uv/install.sh | sh           # uv runs Playwright with its own deps
```

`WALLET_PRIVATE_KEY` must already be in `.env.local` (the funded testnet
signer). If you don't have one yet, see `HANDOFF.md`.

---

## Workflow

### 1. Build + start production server

```bash
cd openvault
rm -rf .next
WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm build
WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm start &
# Wait until http://localhost:3000 responds.
curl -s http://localhost:3000/api/runtime
# → {"workerIsolation":"enclave-sim", ...}
```

### 2. Complete Privy OTP login (headed)

```bash
uv run --with playwright python scripts/demo/prep-login.py
```

A real Chrome window opens at `localhost:3000` and writes session state to
`/tmp/openvault_demo_profile/`.

1. Click **Connect** in the header.
2. Enter your email; check inbox for Privy's OTP code; enter it.
3. Wait until your wallet address shows up in the header (`0x…`).
4. **Copy the address** — you need it for step 3.
5. Wait ~10 seconds so Privy flushes embedded-wallet keys to disk.
6. Close the browser window.

### 3. Fund the Privy wallet

OpenVault's compute / mint flows need real testnet IP. Send some from your
`WALLET_PRIVATE_KEY` signer to the address you just copied:

```bash
pnpm real scripts/demo/fund-privy-wallet.ts 0xYOUR_PRIVY_ADDRESS 2
# (sends 2 IP; the script refuses if the signer would drop below 1 IP reserve)
```

You should see the tx hash + the new balance on the target address.

### 4. Record the demo

```bash
uv run --with playwright python scripts/demo/record-demo.py
```

The script:
- Reads the persistent profile (so the wallet stays connected on camera).
- Warms up `/` for 8s so Privy + WASM rehydrate.
- Walks: landing → Compute filter → gated artifact detail → compute page (NEW
  TEE-SIM disclosure visible) → real **Run confidential job** click (wait 22s
  for tx) → `/group/new` → `/leaderboard` → `/upload` → `/about` with the
  expanded SPEC DISCLOSURES footer.
- Saves per-step screenshots + records the video.
- Converts to MP4 via `ffmpeg` (`H.264, +faststart`).

### Output

| Path | What |
|---|---|
| `/tmp/openvault_demo_video/*.webm` | Raw Playwright recording |
| `/tmp/openvault_demo.mp4` | H.264, share-ready (~30–60 s) |
| `/tmp/openvault_demo_step_NN_<label>.png` | Per-step screenshot |

`ffprobe` the MP4 to confirm non-zero duration:

```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 \
  /tmp/openvault_demo.mp4
```

---

## Editing the lifecycle

The full step list lives at the top of `record-demo.py` in `STEPS`. Each item:

```python
{"do": "goto"|"click"|"fill"|"wait", "target": "...", "wait": ms, "label": "..."}
```

If you want to add an upload + register flow, append fill/click steps that
target the wizard's inputs.

---

## Troubleshooting

- **Recording shows "Connect" instead of a logged-in chip** → profile dir
  doesn't have the Privy session. Re-run `prep-login.py` and leave the browser
  open ~10s after login so keys flush.
- **Run confidential job click doesn't progress on camera** → wallet not
  funded or balance dropped below the mint fee. Top up via
  `fund-privy-wallet.ts`.
- **First `/artifact/<id>` page is blank for ~30s** → you forgot to build in
  production mode. `next dev` compiles routes on first hit, which always
  shows up in the video.
- **ffmpeg fails** → install via `brew install ffmpeg`.
- **uv unknown** → install via `curl -LsSf https://astral.sh/uv/install.sh | sh`.
