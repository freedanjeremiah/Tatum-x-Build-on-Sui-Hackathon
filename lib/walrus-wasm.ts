// Browser Walrus WASM URL resolver.
//
// The in-browser WalrusClient needs the web build of the Walrus WASM to do
// blob writes (writeBlob/writeQuilt encode slivers in WASM). The server build
// loads WASM from node_modules directly and needs no URL.
//
// SOURCE: @mysten/walrus-wasm/web/walrus_wasm_bg.wasm — the official web build
// shipped with the installed @mysten/walrus-wasm package, copied to
// public/walrus/walrus_wasm_bg.wasm by scripts/copy-walrus-wasm.mjs on
// prebuild/predev (version-matched to @mysten/walrus). Served as a static asset.
//
// Override the served path with NEXT_PUBLIC_OV_WALRUS_WASM_URL if you host the
// wasm elsewhere (e.g. a CDN).

/** Default public path the wasm is copied to (see scripts/copy-walrus-wasm.mjs). */
const DEFAULT_WALRUS_WASM_PATH = "/walrus/walrus_wasm_bg.wasm";

/**
 * Resolve the browser Walrus WASM URL, or `undefined` when not in a browser
 * (server/Node loads WASM from node_modules and needs no URL).
 *
 * In the browser the served static path is sufficient (WalrusClient fetches it
 * relative to the origin); an absolute URL is built from window.location.origin
 * so it works regardless of the calling route.
 */
export function browserWalrusWasmUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const override = process.env.NEXT_PUBLIC_OV_WALRUS_WASM_URL;
  const path = override && override.length > 0 ? override : DEFAULT_WALRUS_WASM_PATH;

  // Already absolute (http(s):// or //host) — use as-is.
  if (/^(https?:)?\/\//.test(path)) return path;

  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
}
