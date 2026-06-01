#!/usr/bin/env python3
"""Prep step: open OpenVault in a NON-headless Playwright with a persistent
profile so YOU can click Connect and complete the Privy OTP login. The session
state (cookies, localStorage, embedded-wallet keys) is saved into the profile
dir so the next run (record-demo.py headless) loads already logged in.

Run:
  uv run --with playwright python scripts/demo/prep-login.py
  # browser opens; click Connect → enter email → enter OTP from your inbox
  # leave it open for ~5s after login completes so storage flushes, then close.

After this finishes, the Privy embedded wallet for that email lives in the
profile dir at /tmp/openvault_demo_profile and will be re-used on the next run.
Copy the wallet address shown in the header (or via the Connect dropdown) —
you'll need it for funding.
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
UDIR = "/tmp/openvault_demo_profile"   # persistent profile (Chrome User Data dir equivalent)

os.makedirs(UDIR, exist_ok=True)

VP = {"width": 1440, "height": 900}

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        UDIR,
        headless=False,                  # HEADED — you'll interact with this browser
        viewport=VP,
        args=["--no-sandbox"],
    )
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.on("dialog", lambda d: (print("ALERT:", d.message[:90]), d.accept()))

    print("==> Opening", BASE)
    try:
        pg.goto(BASE, wait_until="domcontentloaded", timeout=90000)
    except Exception as e:
        print("  goto failed:", str(e)[:120])
        sys.exit(1)

    print()
    print("=" * 60)
    print("ACTION REQUIRED — complete Privy login in the open browser:")
    print("  1. Click 'Connect' (top right)")
    print("  2. Enter your email")
    print("  3. Check your inbox for the Privy OTP code and enter it")
    print("  4. Wait until you see your wallet address in the header (0x…)")
    print("  5. COPY THE WALLET ADDRESS — you'll need it for funding.")
    print("  6. Leave the browser open for ~10 seconds after login so")
    print("     Privy flushes the embedded-wallet keys to disk.")
    print("  7. Close the browser window to finish this step.")
    print("=" * 60)
    print()
    print("Profile dir:", UDIR)
    print("(Press Ctrl+C in this terminal if you need to abort.)")
    print()

    # Block until the user closes the window. Playwright raises when the
    # context disappears, which is our exit signal.
    try:
        # Wait indefinitely on the page until it closes.
        pg.wait_for_event("close", timeout=0)
    except Exception:
        pass
    finally:
        try:
            ctx.close()
        except Exception:
            pass

print()
print("Session saved to:", UDIR)
print("Next step: fund your Privy wallet (see fund-privy-wallet.ts), then")
print("           run record-demo.py to capture the headless demo video.")
