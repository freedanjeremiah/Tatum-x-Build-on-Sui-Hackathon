// Reef runtime env vars. Split from lib/constants.ts so constants only
// contain derivable config while this file holds raw env reads for secrets /
// per-deployment ids that must never be inlined as defaults.

/** Privy application id (browser + server). Required for wallet auth. */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/** Tatum API key. Server-only — injected as a request header by the Sui client. */
export const TATUM_API_KEY = process.env.TATUM_API_KEY ?? "";

/**
 * Optional shared secret for the Tatum notification webhook. When set, the
 * /api/tatum/webhook route requires inbound callbacks to carry a matching
 * `x-reef-webhook-secret` header. Server-only — never sent to the browser.
 */
export const TATUM_WEBHOOK_SECRET = process.env.TATUM_WEBHOOK_SECRET ?? "";

/**
 * Public HTTPS URL Tatum POSTs notifications to (e.g.
 * https://<your-host>/api/tatum/webhook). Read by the indexer to register a
 * Tatum address subscription on startup. Empty = push disabled (poll only).
 */
export const REEF_WEBHOOK_URL = process.env.REEF_WEBHOOK_URL ?? "";

// Inference backend (Ollama behind nginx bearer-token proxy on EC2 A10G).
// OpenAI-compatible base, e.g. http://3.111.31.183:8443/v1
// Server-only — the token is NEVER exposed to the client; the /api/run route
// proxies and injects it. Empty = inference disabled (route returns honest 503).
export const INFERENCE_BASE_URL = process.env.INFERENCE_BASE_URL ?? "";
export const INFERENCE_TOKEN = process.env.INFERENCE_TOKEN ?? "";
export const INFERENCE_MODEL = process.env.INFERENCE_MODEL ?? "llama3.1:8b";
