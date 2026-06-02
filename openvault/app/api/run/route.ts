// Inference proxy — forwards a chat completion to the GPU box (Ollama behind a
// Cloudflare Tunnel / nginx bearer-token proxy on the EC2 A10G) and STREAMS
// tokens back.
//
// Why a server route at all: the bearer token is server-only. The browser must
// never see INFERENCE_TOKEN, so it talks to this route, and this route injects
// the Authorization header and proxies upstream.
//
// PUBLIC EXPOSURE: this route is reachable by anyone visiting the deployed site,
// and it spends a single shared A10G. So it is guarded:
//   - per-IP rate limit (best-effort, in-memory — see note on serverless below)
//   - prompt-size cap (reject oversized prompts before touching the GPU)
//   - max_tokens cap (bound generation length / GPU time)
//   - upstream timeout (never hold a GPU slot forever)
//
// HONESTY (matches the no-silent-fallback ethos): if the inference backend is
// not configured or unreachable, we return a clear error — we never fabricate a
// reply or pretend a model ran.

export const runtime = "nodejs";

import { INFERENCE_BASE_URL, INFERENCE_TOKEN, INFERENCE_MODEL } from "@/lib/env";

// ---- Guard limits -----------------------------------------------------------
const MAX_PROMPT_CHARS = 4000; // reject anything larger before hitting the GPU
const MAX_TOKENS = 512; // bound generation length (≈ GPU time per request)
const UPSTREAM_TIMEOUT_MS = 120_000; // hard ceiling on a single generation
const RATE_LIMIT = 8; // requests...
const RATE_WINDOW_MS = 60_000; // ...per IP per minute

// In-memory fixed-window limiter. NOTE: on Vercel each serverless instance has
// its own memory, so this is best-effort, not a global guarantee — it stops
// casual abuse and accidental loops, not a determined distributed attacker. For
// a hard global limit, swap this for Upstash Redis (see HANDOFF). Good enough
// for the "protected public demo" posture.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

function clientIp(req: Request): string {
  // Vercel/proxies set x-forwarded-for: "client, proxy1, proxy2". Take the first.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function err(reason: string, status: number): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!INFERENCE_BASE_URL || !INFERENCE_TOKEN) {
    return err(
      "Inference backend not configured. Set INFERENCE_BASE_URL and INFERENCE_TOKEN.",
      503,
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return err(
      `Rate limit: max ${RATE_LIMIT} requests/min. Slow down and retry shortly.`,
      429,
    );
  }

  let body: { prompt?: string; model?: string; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("invalid JSON body", 400);
  }

  // Accept either a raw prompt or a pre-built messages array.
  const messages =
    Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : typeof body.prompt === "string" && body.prompt.trim()
        ? [{ role: "user", content: body.prompt }]
        : null;

  if (!messages) return err("prompt (or messages) is required", 400);

  // Size cap — measure the serialized messages so a giant messages[] can't slip
  // past a prompt-only check.
  const size = JSON.stringify(messages).length;
  if (size > MAX_PROMPT_CHARS) {
    return err(
      `Prompt too large (${size} chars, max ${MAX_PROMPT_CHARS}).`,
      413,
    );
  }

  const upstream = `${INFERENCE_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${INFERENCE_TOKEN}`,
      },
      body: JSON.stringify({
        model: body.model || INFERENCE_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        stream: true,
      }),
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg =
      (e as Error).name === "AbortError"
        ? "inference timed out"
        : `inference backend unreachable: ${(e as Error).message}`;
    return err(msg, 502);
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const detail = await res.text().catch(() => "");
    return err(`inference backend returned ${res.status}: ${detail}`, 502);
  }

  // Pass the SSE stream straight through to the browser. Clear the timeout when
  // the upstream stream ends so a slow-but-valid generation isn't killed by it
  // mid-flight; the fetch-level timeout already covered connection setup.
  const reader = res.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          clearTimeout(timer);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        clearTimeout(timer);
        controller.close();
      }
    },
    cancel() {
      clearTimeout(timer);
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    },
  });
}
