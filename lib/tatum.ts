// Reef Tatum client — typed wrapper over the Tatum platform, keyed by
// TATUM_API_KEY. This goes BEYOND using Tatum purely as the Sui JSON-RPC
// gateway (lib/clients.ts) and exercises three distinct Tatum capabilities:
//
//   1. Sui RPC gateway reads — reference gas price + chain/epoch status, via the
//      same x-api-key gateway lib/clients.ts already points at.
//   2. Tatum Notification API (v4 subscriptions) — subscribe an address's
//      activity so on-chain updates are PUSHED to a webhook (createAddressSubscription /
//      listSubscriptions / deleteSubscription).
//
// Honest by design: every function here REQUIRES a key and throws a clear error
// when TATUM_API_KEY is absent — no silent fallback, no fabricated data. (The
// public-fullnode fallback lives in lib/clients.ts for plain RPC; the Tatum
// notification/status features are genuinely unavailable without a key, so we
// say so rather than inventing numbers.)
//
// The TATUM_API_KEY is NEVER logged and NEVER returned to a caller.

import { TATUM_API_KEY } from "./env";
import { TATUM_SUI_JSONRPC } from "./constants";

// REST base for the Tatum platform API (Notification subscriptions, etc.).
// Overridable for tests / alternate regions; defaults to the documented base.
const TATUM_API_BASE: string =
  process.env.OV_TATUM_API_BASE && process.env.OV_TATUM_API_BASE.length > 0
    ? process.env.OV_TATUM_API_BASE
    : "https://api.tatum.io";

/** True when a non-empty Tatum API key is configured. */
export function hasTatumKey(): boolean {
  return Boolean(TATUM_API_KEY && TATUM_API_KEY.length > 0);
}

/** Throw a clear, actionable error when no key is configured. Never logs the key. */
function requireKey(feature: string): string {
  if (!hasTatumKey()) {
    throw new Error(
      `Tatum ${feature} is disabled: TATUM_API_KEY is not set. ` +
        `Add TATUM_API_KEY to your environment to enable it.`,
    );
  }
  return TATUM_API_KEY;
}

// ---------------------------------------------------------------------------
// tatumFetch — centralized fetch with the same 429/5xx backoff style as the
// RPC transport in lib/clients.ts (retryingFetch). Attaches the x-api-key
// header. Used for both the RPC gateway and the REST Notification API.
// ---------------------------------------------------------------------------

interface TatumFetchInit {
  method?: string;
  /** JSON body — serialized and sent with content-type: application/json. */
  body?: unknown;
  /** Extra headers (merged after x-api-key + content-type). */
  headers?: Record<string, string>;
  /** Max retries on 429/5xx. */
  maxRetries?: number;
}

/** Low-level fetch to a fully-qualified URL with x-api-key + backoff. */
async function tatumFetchRaw(url: string, init: TatumFetchInit = {}): Promise<Response> {
  const key = requireKey("API");
  const maxRetries = init.maxRetries ?? 5;
  const headers: Record<string, string> = {
    "x-api-key": key,
    ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    ...(init.headers ?? {}),
  };
  const body = init.body !== undefined ? JSON.stringify(init.body) : undefined;

  let delay = 250;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: init.method ?? "GET", headers, body });
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= maxRetries) return res;
    await new Promise<void>((r) => setTimeout(r, delay + Math.floor(delay * 0.3)));
    delay = Math.min(delay * 2, 4000);
  }
}

/** Fetch a REST path under TATUM_API_BASE and parse JSON (throws on non-2xx). */
async function tatumFetch<T>(path: string, init: TatumFetchInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${TATUM_API_BASE}${path}`;
  const res = await tatumFetchRaw(url, init);
  const text = await res.text();
  if (!res.ok) {
    // Surface a short, safe error — never echo the api key (it is a header,
    // not part of the body, so the body is safe to include for diagnostics).
    throw new Error(`Tatum API ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------------------------------------------------------------------------
// Sui JSON-RPC reads via the Tatum gateway (x-api-key). These reuse the same
// gateway URL lib/clients.ts routes through, but issue raw JSON-RPC calls so we
// can surface gas/chain status in the UI.
// ---------------------------------------------------------------------------

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

/** Issue one JSON-RPC call to the Tatum Sui gateway. Throws on RPC error. */
async function suiRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await tatumFetchRaw(TATUM_SUI_JSONRPC, {
    method: "POST",
    body: { jsonrpc: "2.0", id: 1, method, params },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tatum Sui RPC ${res.status} ${method}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(`Tatum Sui RPC ${method} error ${json.error.code}: ${json.error.message}`);
  }
  if (json.result === undefined) {
    throw new Error(`Tatum Sui RPC ${method}: empty result`);
  }
  return json.result;
}

/**
 * Reference gas price (MIST) for the current epoch, via the Tatum Sui gateway
 * (`suix_getReferenceGasPrice`). Returns a bigint. Requires TATUM_API_KEY.
 */
export async function tatumGasPrice(): Promise<bigint> {
  const raw = await suiRpc<string | number>("suix_getReferenceGasPrice", []);
  // The RPC returns the price as a decimal string (u64). BigInt() handles both.
  return BigInt(raw);
}

/** Coarse Sui chain/epoch status surfaced from the Tatum gateway. */
export interface TatumNetworkStatus {
  /** "testnet" | "mainnet" | "devnet" — from lib/constants (SUI_NETWORK). */
  network: string;
  /** Reference gas price in MIST (decimal string; bigint is not JSON-safe). */
  referenceGasPrice: string;
  /** Latest checkpoint sequence number (decimal string). Omitted if the gateway
   *  does not serve `sui_getLatestCheckpointSequenceNumber`. */
  checkpoint?: string;
  /** Current epoch number (decimal string), from the Sui system state. Omitted if
   *  the gateway does not serve `suix_getLatestSuiSystemState`. */
  epoch?: string;
  /** Total stake reported by the system state, if available (decimal string). */
  totalStake?: string;
  /** RPC methods the Tatum gateway did not serve — honest partial disclosure so
   *  the UI can show what's live and "—" for the rest, instead of failing whole. */
  unavailable?: string[];
}

interface SuiSystemStateSummary {
  epoch?: string | number;
  totalStake?: string | number;
  [k: string]: unknown;
}

/**
 * Fetch chain/epoch + gas status from the Tatum Sui gateway. Combines
 * `suix_getReferenceGasPrice`, `sui_getLatestCheckpointSequenceNumber`, and
 * `suix_getLatestSuiSystemState`. Requires TATUM_API_KEY (throws otherwise).
 */
export async function tatumNetworkStatus(): Promise<TatumNetworkStatus> {
  requireKey("network status");
  const { SUI_NETWORK } = await import("./constants");

  // Independent calls: a single method the gateway doesn't serve (e.g. some Tatum
  // gateways lack `suix_getLatestSuiSystemState`) must NOT sink the whole surface.
  const [gasR, cpR, sysR] = await Promise.allSettled([
    suiRpc<string | number>("suix_getReferenceGasPrice", []),
    suiRpc<string | number>("sui_getLatestCheckpointSequenceNumber", []),
    suiRpc<SuiSystemStateSummary>("suix_getLatestSuiSystemState", []),
  ]);

  // Reference gas price is the core Tatum-routed signal; if even that fails the
  // gateway is unusable — surface a real error (route → 502, UI → "—").
  if (gasR.status !== "fulfilled") {
    throw new Error(
      `Tatum gateway error: ${(gasR.reason as Error)?.message ?? "reference gas price unavailable"}`,
    );
  }

  const unavailable: string[] = [];
  const status: TatumNetworkStatus = {
    network: SUI_NETWORK,
    referenceGasPrice: BigInt(gasR.value).toString(),
  };

  if (cpR.status === "fulfilled") status.checkpoint = String(cpR.value);
  else unavailable.push("sui_getLatestCheckpointSequenceNumber");

  if (sysR.status === "fulfilled") {
    if (sysR.value.epoch !== undefined) status.epoch = String(sysR.value.epoch);
    if (sysR.value.totalStake !== undefined) status.totalStake = String(sysR.value.totalStake);
  } else {
    unavailable.push("suix_getLatestSuiSystemState");
  }

  if (unavailable.length > 0) status.unavailable = unavailable;
  return status;
}

// ---------------------------------------------------------------------------
// Tatum Notification API — v4 address subscriptions.
//
// Endpoint: POST/GET/DELETE {TATUM_API_BASE}/v4/subscription
//
// ASSUMPTION (documented): Tatum's v4 subscription model uses a `type`
// discriminator plus an `attr` bag carrying { address, chain, url }. The
// canonical incoming-activity type across chains is `ADDRESS_EVENT` (a.k.a.
// "incoming transactions / address event"); when Sui is the target chain we
// pass the configured network as `chain`. If Tatum names the Sui-specific
// subscription type differently, override via OV_TATUM_SUB_TYPE /
// OV_TATUM_SUB_CHAIN without code edits. The request/response are typed to the
// documented shape; the webhook receiver (app/api/tatum/webhook) validates
// whatever actually arrives rather than trusting this shape blindly.
// ---------------------------------------------------------------------------

const SUB_TYPE: string =
  process.env.OV_TATUM_SUB_TYPE && process.env.OV_TATUM_SUB_TYPE.length > 0
    ? process.env.OV_TATUM_SUB_TYPE
    : "ADDRESS_EVENT";

/** Tatum chain slug for the subscription `attr.chain`. Defaults from SUI_NETWORK. */
function subChain(network: string): string {
  if (process.env.OV_TATUM_SUB_CHAIN && process.env.OV_TATUM_SUB_CHAIN.length > 0) {
    return process.env.OV_TATUM_SUB_CHAIN;
  }
  // Tatum slugs Sui networks as sui-mainnet / sui-testnet / sui-devnet.
  return `sui-${network}`;
}

/** A single Tatum subscription as returned by GET /v4/subscription. */
export interface TatumSubscription {
  id: string;
  type: string;
  attr: {
    address?: string;
    chain?: string;
    url?: string;
    [k: string]: unknown;
  };
}

/** Response of POST /v4/subscription (the created subscription's id). */
interface CreateSubscriptionResponse {
  id: string;
}

/**
 * Subscribe an address's on-chain activity so Tatum PUSHES updates to
 * `webhookUrl`. Returns the new subscription id. Requires TATUM_API_KEY.
 *
 * @param address    On-chain address to watch (e.g. the Reef publisher).
 * @param webhookUrl Public HTTPS URL Tatum will POST notifications to.
 */
export async function createAddressSubscription(
  address: string,
  webhookUrl: string,
): Promise<string> {
  requireKey("notification subscription");
  const { SUI_NETWORK } = await import("./constants");
  const res = await tatumFetch<CreateSubscriptionResponse>("/v4/subscription", {
    method: "POST",
    body: {
      type: SUB_TYPE,
      attr: {
        address,
        chain: subChain(SUI_NETWORK),
        url: webhookUrl,
      },
    },
  });
  return res.id;
}

/** List all active Tatum subscriptions for this API key. Requires TATUM_API_KEY. */
export async function listSubscriptions(): Promise<TatumSubscription[]> {
  requireKey("notification subscription");
  // GET /v4/subscription returns an array of subscriptions (paginated by Tatum;
  // the first page is sufficient for Reef's single publisher subscription).
  return tatumFetch<TatumSubscription[]>("/v4/subscription?pageSize=50");
}

/** Delete a Tatum subscription by id. Requires TATUM_API_KEY. */
export async function deleteSubscription(id: string): Promise<void> {
  requireKey("notification subscription");
  await tatumFetch<unknown>(`/v4/subscription/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Idempotently ensure an ADDRESS_EVENT subscription exists for (address →
 * webhookUrl). Returns the existing or newly-created subscription id. Used by
 * the indexer on startup so repeated restarts don't pile up duplicate
 * subscriptions. Requires TATUM_API_KEY.
 */
export async function ensureAddressSubscription(
  address: string,
  webhookUrl: string,
): Promise<{ id: string; created: boolean }> {
  const addrLc = address.toLowerCase();
  const existing = await listSubscriptions();
  const match = existing.find(
    (s) =>
      typeof s.attr?.address === "string" &&
      s.attr.address.toLowerCase() === addrLc &&
      s.attr?.url === webhookUrl,
  );
  if (match) return { id: match.id, created: false };
  const id = await createAddressSubscription(address, webhookUrl);
  return { id, created: true };
}
