#!/usr/bin/env bash
# Regenerate the in-enclave TS worker bundle (worker/enclave-server.ts -> a single
# CommonJS file) plus the Walrus WASM asset it loads at import. Output lands in
# nautilus/enclave/dist/, which the enclave Dockerfile copies into the EIF.
#
# The bundle is a BUILD ARTIFACT (gitignored, like the EIF). This script makes it
# reproducible from the committed worker/ + lib/ TypeScript sources.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/dist"
mkdir -p "$OUT_DIR"

cd "$REPO_ROOT"

# esbuild may not be a repo dependency; fetch a pinned copy into a scratch dir.
ESBUILD_BIN="$(command -v esbuild || true)"
if [ -z "$ESBUILD_BIN" ]; then
  TMP_ESB="$(mktemp -d)"
  ( cd "$TMP_ESB" && npm init -y >/dev/null 2>&1 && npm i esbuild@0.24.0 >/dev/null 2>&1 )
  ESBUILD_BIN="$TMP_ESB/node_modules/.bin/esbuild"
fi

"$ESBUILD_BIN" worker/enclave-server.ts \
  --bundle --platform=node --target=node20 --format=cjs \
  --external:'*.node' \
  --outfile="$OUT_DIR/enclave-bundle.cjs"

# The @mysten/walrus-wasm package reads walrus_wasm_bg.wasm relative to its module
# dir at import; after bundling it resolves next to the bundle. Copy it there.
WASM="$(find node_modules -name walrus_wasm_bg.wasm -path '*nodejs*' 2>/dev/null | head -1)"
if [ -z "$WASM" ]; then
  echo "error: walrus_wasm_bg.wasm not found under node_modules (run pnpm install first)" >&2
  exit 1
fi
cp "$WASM" "$OUT_DIR/walrus_wasm_bg.wasm"

echo "wrote:"
ls -lh "$OUT_DIR"
