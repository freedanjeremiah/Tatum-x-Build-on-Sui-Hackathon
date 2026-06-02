export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const PINATA_JWT = process.env.PINATA_JWT ?? "";

// Inference backend (Ollama behind nginx bearer-token proxy on EC2 A10G).
// OpenAI-compatible base, e.g. http://3.111.31.183:8443/v1
// Server-only — the token is NEVER exposed to the client; the /api/run route
// proxies and injects it. Empty = inference disabled (route returns honest 503).
export const INFERENCE_BASE_URL = process.env.INFERENCE_BASE_URL ?? "";
export const INFERENCE_TOKEN = process.env.INFERENCE_TOKEN ?? "";
export const INFERENCE_MODEL = process.env.INFERENCE_MODEL ?? "llama3.1:8b";
