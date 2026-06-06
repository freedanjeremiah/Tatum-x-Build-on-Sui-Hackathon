import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/indexer/db BEFORE any route import — compute/route.ts calls
// openDb() (no REEF_DB_PATH trick) and getArtifact at module scope. We provide
// a controlled fake that returns a compute-tier dataset by default.
// ---------------------------------------------------------------------------
const mockDataset = {
  ipId: "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`,
  tier: "compute" as const,
  modality: "dataset" as const,
  title: "Test Dataset",
  description: "A test compute dataset",
  tags: ["test"],
  ipMetadataURI: "walrus://meta",
  createdTx: "0xabcdef01" as `0x${string}`,
  computeEnabled: true,
  allowedAlgoHashes: ["sha256:mean-aggregate"],
};

vi.mock("@/indexer/db", () => ({
  openDb: vi.fn(() => ({})),   // returns a dummy DB object (never used directly)
  getArtifact: vi.fn((_db: unknown, _ipId: string) => mockDataset),
  upsertArtifact: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/enclaveClient so no real network is touched.
// ---------------------------------------------------------------------------
vi.mock("@/lib/enclaveClient", () => ({
  ENCLAVE_URL_ENV: "ENCLAVE_PROCESS_URL",
  callEnclave: vi.fn(async () => ({
    metrics: { n: 5 },
    metricsBytes: new Uint8Array([1, 2, 3]),
    timestampMs: 1717000000000n,
    signature: new Uint8Array(64).fill(9),
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/worker/compute-worker so the legacy path doesn't touch fs/native.
// ---------------------------------------------------------------------------
vi.mock("@/worker/compute-worker", () => ({
  runComputeJob: vi.fn(async () => ({
    status: "done",
    metrics: { count: 3 },
    resultIpId: undefined,
    resultTx: undefined,
    decryptCalled: true,
    isolationMode: "plain-server (operator-trusted, demo)",
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/clients to avoid real key parsing.
// ---------------------------------------------------------------------------
vi.mock("@/lib/clients", () => ({
  makeClientsFromKey: vi.fn(async () => ({
    client: {},
    keypair: {},
    signer: {},
    address: "0xabc",
    account: { address: "0xabc" },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/registry so no real Sui tx is submitted.
// ---------------------------------------------------------------------------
vi.mock("@/lib/registry", () => {
  class RegistryClient {
    constructor(_client: unknown) {}
    async registerDerivativeAttested(_args: unknown, _signer: unknown): Promise<string> {
      return "0xdeadbeef01020304";
    }
  }
  return { RegistryClient };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("/api/compute enclave-nautilus fail-closed", () => {
  beforeEach(() => {
    process.env.WORKER_ISOLATION_MODE = "enclave-nautilus";
  });
  afterEach(() => {
    delete process.env.WORKER_ISOLATION_MODE;
    delete process.env.ENCLAVE_PROCESS_URL;
    delete process.env.REEF_ENCLAVE_OBJECT_ID;
    delete process.env.WALLET_PRIVATE_KEY;
    vi.resetModules();
  });

  it("returns failed (no silent fallback) when enclave mode set but ENCLAVE_PROCESS_URL missing", async () => {
    delete process.env.ENCLAVE_PROCESS_URL;
    delete process.env.REEF_ENCLAVE_OBJECT_ID;
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.status).toBe("failed");
    expect(body.decryptCalled).toBe(false);
    // Must NOT silently fall back
    expect(body.reason).toMatch(/enclave-nautilus/);
  });

  it("returns failed when ENCLAVE_PROCESS_URL set but REEF_ENCLAVE_OBJECT_ID missing", async () => {
    process.env.ENCLAVE_PROCESS_URL = "http://enclave.local";
    delete process.env.REEF_ENCLAVE_OBJECT_ID;
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.status).toBe("failed");
    expect(body.decryptCalled).toBe(false);
  });

  it("returns rejected when algoHash not in dataset allowedAlgoHashes", async () => {
    process.env.ENCLAVE_PROCESS_URL = "http://enclave.local";
    process.env.REEF_ENCLAVE_OBJECT_ID = "0xenclave001";
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:disallowed-algo" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("rejected");
    expect(body.decryptCalled).toBe(false);
  });

  it("returns failed when WALLET_PRIVATE_KEY missing after enclave call", async () => {
    process.env.ENCLAVE_PROCESS_URL = "http://enclave.local";
    process.env.REEF_ENCLAVE_OBJECT_ID = "0xenclave001";
    delete process.env.WALLET_PRIVATE_KEY;
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.status).toBe("failed");
    expect(body.reason).toMatch(/WALLET_PRIVATE_KEY/);
  });

  it("returns done with attestation when all env vars present and enclave succeeds", async () => {
    process.env.ENCLAVE_PROCESS_URL = "http://enclave.local";
    process.env.REEF_ENCLAVE_OBJECT_ID = "0xenclave001";
    process.env.WALLET_PRIVATE_KEY = "0x" + "ab".repeat(32);
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("done");
    expect(body.decryptCalled).toBe(true);
    expect(body.isolationMode).toMatch(/Nitro enclave/);
    expect(body.attestation?.workerIsolation).toBe("enclave-nautilus");
    expect(body.attestation?.enclaveObjectId).toBe("0xenclave001");
  });
});

describe("/api/compute legacy (non-enclave) path", () => {
  afterEach(() => {
    delete process.env.WORKER_ISOLATION_MODE;
    vi.resetModules();
  });

  it("delegates to runComputeJob when not in enclave-nautilus mode", async () => {
    delete process.env.WORKER_ISOLATION_MODE; // defaults to plain-server
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://x/api/compute", {
        method: "POST",
        body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
      })
    );
    const body = await res.json();
    // runComputeJob mock returns { status: "done", metrics: { count: 3 } }
    expect(body.status).toBe("done");
    expect(body.metrics).toEqual({ count: 3 });
  });
});
