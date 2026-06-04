// Copy the browser Walrus WASM into public/ so the in-browser WalrusClient can
// fetch it at runtime.
//
// SOURCE: @mysten/walrus-wasm/web/walrus_wasm_bg.wasm (the official web build
// shipped with the installed @mysten/walrus-wasm package — version-matched to
// @mysten/walrus). Copied to public/walrus/walrus_wasm_bg.wasm, served at
// /walrus/walrus_wasm_bg.wasm. lib/walrus-wasm.ts exposes that path as the
// wasmUrl passed into getStorage() on the browser upload path.
//
// Runs on prebuild + predev so the file is always present and matches the
// installed package after a fresh install (the copy in public/ is git-ignored
// to avoid committing a binary that can drift from the dependency).

import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const src = require.resolve("@mysten/walrus-wasm/web/walrus_wasm_bg.wasm");
const destDir = join(root, "public", "walrus");
const dest = join(destDir, "walrus_wasm_bg.wasm");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);

// eslint-disable-next-line no-console
console.log(`[walrus-wasm] copied ${src} -> ${dest}`);
