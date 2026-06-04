// Test-only helpers for live-network integration tests. Gated by RUN_INTEGRATION
// so a bare `vitest run` neither needs creds nor spends gas/WAL. Imports only
// lib/clients (the Sui core client factory).
export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1";

/** Build a real server client bundle from WALLET_PRIVATE_KEY (Sui core shape). */
export async function realClients() {
  const { makeClientsFromKey } = await import("./clients");
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) throw new Error("WALLET_PRIVATE_KEY required for integration tests");
  return makeClientsFromKey(pk);
}
