#!/usr/bin/env python3
"""Record a step-by-step OpenVault lifecycle demo with headless Playwright.

Prereqs (run once before this):
  1. Production server up:
       cd openvault && rm -rf .next && \
       WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret \
       pnpm build && pnpm start &
  2. Privy login completed via prep-login.py (persistent profile written).
  3. The Privy wallet funded by running fund-privy-wallet.ts.

Run:
  uv run --with playwright python scripts/demo/record-demo.py

Outputs:
  /tmp/openvault_demo_video/*.webm  (raw Playwright recording)
  /tmp/openvault_demo.mp4           (H.264, faststart — share-ready)
  /tmp/openvault_demo_step_*.png    (per-step screenshots)

The flow mirrors the product lifecycle a judge would walk through:
  landing → connected → browse compute → artifact detail → run compute job
  → group create → leaderboard → about (disclosures).
"""
import os, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
UDIR = "/tmp/openvault_demo_profile"            # MUST match prep-login.py
WARMUP_ROUTE = "/"                              # warm one route so wallet rehydrates
VID_DIR = "/tmp/openvault_demo_video"
MP4 = "/tmp/openvault_demo.mp4"

# ---------- COMPUTE artifact to drive ----------
# Confidential Numeric Rows — gated by ComputeWorkerReadCondition. We pick this
# one because /compute/<ipId> visibly demonstrates the enclave-sim TEE
# disclosure that ships with this branch.
COMPUTE_IP_ID = "0x013316E563F6676E62aEEeB772D7450dd388740e"
ARTIFACT_IP_ID = "0xfAC62e62018CAAe65B13398A1fb4B2e492D069a1"  # SentimentLLM-7B (gated)

# Each step: do = goto|click|fill|wait; wait = ms after action.
STEPS = [
    {"do": "goto",  "target": "/",                                    "wait": 6000,  "label": "landing"},
    {"do": "wait",  "target": "",                                     "wait": 4000,  "label": "browse_settle"},
    # Show the compute filter chip (a one-click way into compute tier).
    {"do": "click", "target": "Compute",                              "wait": 3500,  "label": "filter_compute"},
    # Navigate to the gated artifact detail (full PROVENANCE sidebar).
    {"do": "goto",  "target": f"/artifact/{ARTIFACT_IP_ID}",          "wait": 7000,  "label": "artifact_detail_gated"},
    # Navigate to the compute page — the NEW honest TEE-SIM disclosure renders here.
    {"do": "goto",  "target": f"/compute/{COMPUTE_IP_ID}",            "wait": 8000,  "label": "compute_page_with_sim_disclosure"},
    # Actually run a confidential job (wallet must be funded for license fee).
    {"do": "click", "target": "Run confidential job",                 "wait": 22000, "label": "run_compute_job"},
    # Group CREATE — the new UI shipped this milestone.
    {"do": "goto",  "target": "/group/new",                           "wait": 6000,  "label": "group_create_page"},
    # Leaderboard — trophy badges + scores.
    {"do": "goto",  "target": "/leaderboard",                         "wait": 5000,  "label": "leaderboard"},
    # Upload wizard — shows the 5-step stepper.
    {"do": "goto",  "target": "/upload",                              "wait": 5000,  "label": "upload_wizard"},
    # About + bottom disclosure footer — wraps the honest-disclosure story.
    {"do": "goto",  "target": "/about",                               "wait": 5000,  "label": "about"},
    {"do": "click", "target": "SPEC DISCLOSURES",                     "wait": 4000,  "label": "expand_disclosures"},
]


def do_click(pg, text):
    try:
        pg.get_by_text(text, exact=False).first.click(timeout=12000)
        return True
    except Exception as e:
        print(f"  click '{text}' failed ({str(e)[:60]}) — continuing")
        return False


def main():
    if not os.path.isdir(UDIR):
        print(f"!! profile dir missing: {UDIR}")
        print("   Run scripts/demo/prep-login.py first to complete Privy OTP login.")
        sys.exit(1)

    os.makedirs(VID_DIR, exist_ok=True)
    vp = {"width": 1440, "height": 900}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            UDIR,
            headless=True,
            viewport=vp,
            args=["--no-sandbox"],
            record_video_dir=VID_DIR,
            record_video_size=vp,
        )
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        pg.on("dialog", lambda d: (print("ALERT:", d.message[:90]), d.accept()))

        # Warmup: let the wallet/Privy state rehydrate from the persistent
        # profile BEFORE the first on-camera frame.
        print("==> Warming up", BASE + WARMUP_ROUTE)
        try:
            pg.goto(BASE + WARMUP_ROUTE, wait_until="domcontentloaded", timeout=90000)
        except Exception as e:
            print("  warmup goto failed:", str(e)[:120])
        pg.wait_for_timeout(8000)

        for i, s in enumerate(STEPS):
            label = s.get("label", "")
            print(f"[step {i:02d}] {label}")
            do = s["do"]
            if do == "goto":
                try:
                    pg.goto(BASE + s["target"], wait_until="domcontentloaded", timeout=90000)
                except Exception as e:
                    print(f"  goto failed: {str(e)[:80]}")
            elif do == "click":
                do_click(pg, s["target"])
            elif do == "fill":
                sel, val = s["target"].split("::", 1)
                try:
                    pg.fill(sel, val, timeout=8000)
                except Exception as e:
                    print(f"  fill failed: {str(e)[:60]}")
            elif do == "wait":
                pass
            pg.wait_for_timeout(s.get("wait", 3000))
            try:
                pg.screenshot(path=f"/tmp/openvault_demo_step_{i:02d}_{label}.png")
            except Exception:
                pass

        path = pg.video.path() if pg.video else None
        ctx.close()  # finalizes the .webm
        print("WEBM:", path)

    if path and os.path.exists(path):
        print("==> Converting to MP4…")
        r = subprocess.run(
            [
                "ffmpeg", "-y", "-i", path,
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                MP4,
            ],
            capture_output=True,
        )
        if r.returncode == 0:
            print("MP4:", MP4)
            # Print video duration so the user can sanity-check.
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", MP4],
                capture_output=True, text=True,
            )
            if probe.returncode == 0:
                print("Duration:", probe.stdout.strip(), "seconds")
        else:
            print("ffmpeg failed:", r.stderr.decode()[:200])


if __name__ == "__main__":
    main()
