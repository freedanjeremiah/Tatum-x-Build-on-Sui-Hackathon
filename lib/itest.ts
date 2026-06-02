// Test-only helpers for live-network integration tests. Gated by RUN_INTEGRATION
// so a bare `vitest run` neither needs creds nor spends gas. Imports only lib/clients.
export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1";

export async function realClients() {
  const { makeClientsFromKey } = await import("./clients");
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) throw new Error("WALLET_PRIVATE_KEY required for integration tests");
  return makeClientsFromKey(pk as `0x${string}`);
}
