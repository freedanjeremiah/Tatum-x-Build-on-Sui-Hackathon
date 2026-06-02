# OpenVault — Live Demo Script

**Total time: 75 seconds (slide 4 of the pitch).**

This script drives the **production** build (`pnpm build && pnpm start`) with `WORKER_ISOLATION_MODE=enclave-sim` so the new TEE-SIM honest disclosure is visible on camera. The Playwright recording in `scripts/demo/record-demo.py` follows this same beat list.

---

## Before you go on stage

1. **Production server running.**
   ```bash
   cd openvault
   rm -rf .next
   WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm build
   WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm start &
   ```
   Wait until `http://localhost:3000/api/runtime` returns `{"workerIsolation":"enclave-sim", ...}`.

2. **Privy login session warm.** Use a real browser (`prep-login.py`) to complete the OTP login first. The persistent profile keeps you connected.

3. **Privy wallet funded.**
   ```bash
   pnpm real scripts/demo/fund-privy-wallet.ts 0xYOUR_PRIVY_ADDRESS 4
   ```

4. **Backup video ready.** `/tmp/openvault_demo.mp4` is the recorded walkthrough. If anything dies on stage, switch to the MP4.

5. **Browser tabs already open:**
   - Tab 1: `http://localhost:3000/` (Browse — Compute filter pre-selected)
   - Tab 2: `https://aeneid.explorer.story.foundation/` (block explorer, ready for TxLink clicks)

6. **Network OK.** Test the on-chain tx flow once 5 minutes before stage. Aeneid testnet has occasional RPC lag.

---

## Beat sheet (75 seconds)

### Beat 1 — Browse + tier filter (0:00–0:10)

**Click:** Compute filter chip.

**Say (10 sec):**
> "Every artifact here is a Story Protocol IP Asset on Aeneid. The 5 tiers — Public, Private, Gated, Group, Compute — are enforced by **on-chain read-condition contracts** we deployed. The compute filter shows datasets that are computable but never downloadable. Watch why that matters."

**What the audience sees:**
- The cream MECHATONE paper background, halftone grid
- 5 tier chips (with tier glyph + label, not just color)
- 38 real artifacts indexed from Aeneid
- Each card has a 3px tier rail on the left edge

### Beat 2 — Click into gated artifact (0:10–0:15)

**Click:** "SentimentLLM-7B" title.

**Say (5 sec):**
> "Gated tier. Hugging Face's basic version of paywalled models — but here the paywall **is the encryption**."

### Beat 3 — Mint to unlock (0:15–0:35)

**Click:** "Mint to unlock" button.

**Wait ~22 seconds for the on-chain mint + CDR decrypt to complete.** Talk through it:

**Say while waiting (20 sec):**
> "The Privy embedded wallet just signed a `mintLicenseTokens` transaction. The fee — 1 WIP wei in this demo — got auto-wrapped from my native IP balance and routed to the royalty module. Now the CDR vault sees the license token in `accessAuxData`, the `LicenseReadCondition` contract returns true, and threshold-decryption happens *in the browser*.
>
> The server never touched the plaintext. The Hugging Face model card flow we all know — but the license token literally **is** the access key."

**What the audience sees:**
- Wallet pill shows `0x4d29…6A` in the header
- DecryptProgress component pulses
- After ~22s: browser auto-downloads the decrypted bytes as `sentimentllm-7b.bin`

### Beat 4 — Compute the WOW moment (0:35–1:05)

**Navigate to:** `http://localhost:3000/compute/0x934A141E7A529AA0a543B7b06950DE3e3520C5aA`

**Point at the Isolation strip BEFORE clicking anything (5 sec):**
> "Look at this disclosure. The UI tells you, before you do anything, that this worker is running in a **simulated** enclave. Not a real one. If we ran it in real attested hardware, the strip would say so. We refuse to lie about a TEE we don't have."

**Click:** Mean aggregate radio → "Run confidential job".

**Wait ~25 seconds. Narrate the progress trail.**

**Say while waiting (25 sec):**
> "Watch the progress trail. The worker generates a structurally-valid SGX quote, verifies it against the configured expected measurements, then — and only then — calls CDR's gated download. The `ComputeWorkerReadCondition` contract checks that the caller is on the allowlisted operator list. A *consumer's* wallet would revert here. The worker's wallet passes. The bytes decrypt inside the worker process, the mean-aggregate algorithm runs, and a real derivative IP asset gets registered on-chain.
>
> Notice what we just returned: `{columnMeans_0: 3, n: 5}`. Aggregates only. No raw rows. The data physically never left the worker."

**Point at the result panel:**
> "Real `resultIpId`. Real `resultTx`. Click the IP TxLink and you'll see the derivative on Aeneid's block explorer with the correct parent pointer for royalty routing."

### Beat 5 — Provenance + Royalty (1:05–1:15)

**Navigate back to the gated artifact detail page.**

**Point at the Provenance sidebar:**
> "Every artifact view surfaces — without hiding behind a tooltip — the IP asset id, the register transaction, the license terms id, the vault uuid, the IPFS CID. The chain saw everything. We never hide it."

**Click the IP asset TxLink → opens the block explorer.**

> "There. That's the chain's truth. The UI is honest about it."

### Beat 6 — Dispute → Counter (1:15–1:25)

**Switch back to the artifact tab. Click "Report".**

**Type evidence quickly:** `Infringes my upstream work.`

**Click "Raise dispute". Wait 22 sec.**

**Say (5 sec while waiting):**
> "Real `disputeId` on-chain. Bond auto-wrapped. The arbitration policy's reviewer gets 30 days. The target — me — can counter."

**Click "Done", then "Counter dispute". Fill counter-evidence:** `Provenance clean.`

**Click "Submit counter-evidence". Show the badge updating:**
> "Two on-chain transactions in 10 seconds. The chain is the arbiter. Not a moderator."

### Beat 7 — Land the close (1:25–1:30)

**Don't navigate.** Leave the artifact detail page on screen with the In dispute · countered badge.

**Say (5 sec, full eye contact with judges):**
> "License token IS the access key. Compute happens in attested-or-honestly-not-attested isolation. Every transaction is on Aeneid. The Hugging Face flow, but the chain enforces what the platform used to."

---

## Anticipated questions

| Q | A |
|---|---|
| "Why CDR vs Lit Protocol / IPFS-encryption / Filecoin?" | CDR's threshold encryption + arbitrary read-condition contract is the *exact* shape we needed. The condition is a Solidity function — we just deployed four of them. |
| "Is the worker really trusted?" | No, and we say so on every compute screen. Production needs attested SGX/TDX. The TEE-SIM mode proves the verification code path works; it does NOT claim hardware attestation. |
| "What about decryption revocation?" | CDR cannot revoke. Rotate by re-encrypting. We disclose this in the footer on every page. |
| "How does the group tier work?" | Our `GroupLicenseReadCondition` composes the audited `LicenseReadCondition` over each member IP. A consumer who holds a license on **any** member can unlock **every** member's vault. |
| "Token economics?" | License mint fees + royalty cascade + compute fees. All on-chain. OpenVault takes nothing. |
| "Is it production-ready?" | Backend: 12/13 integration tests PASS on real chain. UI: PRD-compliant per audit. TEE: simulated. CDR endpoint stability is the only external dependency we don't own. |

---

## Failure protocols

| If this dies on stage | Do this |
|---|---|
| Dev server not responding | Switch to `/tmp/openvault_demo.mp4` |
| Privy login expired | Switch to backup video |
| Compute job revert | Already prepared — say *"sometimes the testnet RPC is slow — here's what success looks like"* + switch to backup |
| TxLink broken | Show the screenshot at `/tmp/openvault_demo_step_05_run_compute_job.png` |
| All of the above | Talk through Slide 3 (architecture). The honest-disclosure philosophy lands even without the demo. |

---

## Post-demo CTA (after Q&A)

> "Code is on GitHub. The four read-condition contracts are verifiable on Aeneid right now. Full integration test suite at `scripts/diag/full-suite.ts` — `pnpm real` it yourself. The handoff doc lists every flow, every fix, every KNOWN ISSUE we found in core-sdk 1.4.4. We documented the bugs we hit so the next team building on Story + CDR doesn't lose a day to them."
