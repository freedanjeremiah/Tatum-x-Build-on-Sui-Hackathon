// Tatum Notification webhook receiver.
//
// Tatum POSTs here when the subscribed Reef publisher address has on-chain
// activity (registered via lib/tatum.createAddressSubscription). This is the
// PUSH complement to the indexer's queryEvents poll.
//
// SECURITY / HONESTY invariants:
//   - Never trust the payload as authoritative. Tatum tells us "something
//     happened"; the CHAIN remains the only source of truth. We validate the
//     shape, then trigger a `drainOnce` that re-reads the actual Move events via
//     the Tatum Sui gateway and upserts them through the SAME handler the poll
//     uses. We do NOT write artifact rows straight from the webhook body.
//   - Optional shared secret: if TATUM_WEBHOOK_SECRET is set, require a matching
//     `x-reef-webhook-secret` header; otherwise reject with 401. When the secret
//     is unset we accept (dev), but still validate the body shape.
//   - Respond 200 fast. The drain is fire-and-forget so Tatum isn't held open
//     (and won't retry-storm on a slow chain read).
//   - Never stores secrets/plaintext; this route only touches the public read
//     model, exactly like the poll path.

export const runtime = "nodejs"; // Edge unsupported for sqlite + indexer

import { TATUM_WEBHOOK_SECRET } from "@/lib/env";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Minimal shape check for a Tatum ADDRESS_EVENT notification. We don't enforce
 * exact fields (Tatum's payload varies by chain/subscription type), but we do
 * require a JSON object — never an array, string, or null. The address/txId, if
 * present, are logged for traceability only; the drain re-derives truth on-chain.
 */
function isPlausibleNotification(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

let _draining = false;

/**
 * Trigger an incremental drain of new on-chain events into the read model.
 * Guarded so overlapping webhooks don't run concurrent drains (the cursor makes
 * a single drain catch up everything anyway). Best-effort: errors are logged,
 * never surfaced to Tatum (the poll loop is the reliable fallback).
 */
async function triggerDrain(): Promise<void> {
  if (_draining) return;
  _draining = true;
  try {
    const { makeSuiClient } = await import("@/lib/clients");
    const { openDb } = await import("@/indexer/db");
    const { drainOnce } = await import("@/indexer/listen");
    const db = openDb(process.env.REEF_DB_PATH || undefined);
    const n = await drainOnce(makeSuiClient(), db);
    if (n > 0) console.log(`[tatum-webhook] push drained ${n} on-chain event(s)`);
  } catch (e) {
    console.warn(`[tatum-webhook] drain failed (poll will catch up): ${(e as Error).message}`);
  } finally {
    _draining = false;
  }
}

export async function POST(req: Request): Promise<Response> {
  // 1) Optional shared-secret gate.
  if (TATUM_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-reef-webhook-secret") ?? "";
    if (provided !== TATUM_WEBHOOK_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  // 2) Parse + validate the payload shape (never trust it as data).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!isPlausibleNotification(body)) {
    return json({ error: "expected a JSON object notification" }, 400);
  }

  // 3) Fire-and-forget the drain; respond 200 immediately so Tatum is satisfied.
  //    The chain read happens asynchronously and never blocks the ack.
  void triggerDrain();

  return json({ ok: true });
}

/** GET is a liveness probe so operators can confirm the endpoint is reachable. */
export async function GET(): Promise<Response> {
  return json({
    ok: true,
    endpoint: "tatum-notification-webhook",
    secretRequired: Boolean(TATUM_WEBHOOK_SECRET),
  });
}
