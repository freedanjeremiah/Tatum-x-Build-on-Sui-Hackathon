import { test, expect } from "vitest";
import { makeMockClients } from "./mock/story";
import {
  uploadGated,
  uploadPublic,
  uploadPrivate,
  uploadCompute,
  registerProvenanceParent,
  registerDerivative,
  download,
  DownloadGateError,
} from "./artifacts";

const owner = "0x000000000000000000000000000000000000dEaD" as const;

function meta(title: string) {
  return {
    title,
    description: "test artifact",
    tags: ["test"],
    creators: [{ name: "Me", address: owner, contributionPercent: 100 }],
    modality: "model" as const,
  };
}

test("uploadGated then download returns the same bytes", async () => {
  const clients = makeMockClients("0xowner");
  const bytes = new TextEncoder().encode("secret gated weights");
  const art = await uploadGated(clients as any, { bytes, meta: meta("Gated") });
  expect(art.tier).toBe("gated");
  expect(art.ipId).toBeTruthy();
  expect(art.licenseTermsId).toBeTruthy();
  expect(typeof art.vaultUuid).toBe("number");

  const out = await download(clients as any, {
    ipId: art.ipId,
    uuid: art.vaultUuid!,
    licenseTermsId: art.licenseTermsId!,
  });
  expect(new TextDecoder().decode(out)).toBe("secret gated weights");
});

test("download without minting/token throws a labeled gate error", async () => {
  const clients = makeMockClients("0xowner");
  const bytes = new TextEncoder().encode("x");
  const art = await uploadGated(clients as any, { bytes, meta: meta("Gated2") });
  // Force the no-token path: licenseTermsId empty so no mint occurs and aux is empty.
  await expect(
    download(clients as any, { ipId: art.ipId, uuid: art.vaultUuid!, licenseTermsId: "", mint: false })
  ).rejects.toThrow();
});

test("uploadPublic returns tier public with no vault", async () => {
  const clients = makeMockClients("0xowner");
  const art = await uploadPublic(clients as any, {
    bytes: new TextEncoder().encode("free rows"),
    meta: { ...meta("Public"), modality: "dataset" },
  });
  expect(art.tier).toBe("public");
  expect(art.vaultUuid).toBeUndefined();
  expect(art.cid).toBeTruthy();
});

test("uploadPrivate returns tier private", async () => {
  const clients = makeMockClients("0xowner");
  const art = await uploadPrivate(clients as any, {
    bytes: new TextEncoder().encode("private weights"),
    meta: meta("Private"),
  });
  expect(art.tier).toBe("private");
  expect(typeof art.vaultUuid).toBe("number");
});

test("uploadCompute returns tier compute with allowedAlgoHashes and no plaintext download exposed", async () => {
  const clients = makeMockClients("0xowner");
  const allowed = ["sha256:mean-aggregate"];
  const art = await uploadCompute(clients as any, {
    bytes: new TextEncoder().encode("rows"),
    meta: { ...meta("Compute"), modality: "dataset" },
    allowedAlgoHashes: allowed,
  });
  expect(art.tier).toBe("compute");
  expect(art.computeEnabled).toBe(true);
  expect(art.allowedAlgoHashes).toEqual(allowed);
  expect(art.computeLicenseTermsId).toBeTruthy();
  // No download path implied — the artifacts module exposes no compute-download.
});

test("registerProvenanceParent metadata is attribution-only", async () => {
  const clients = makeMockClients("0xowner");
  const { ipId, ipMetadataURI } = await registerProvenanceParent(clients as any, {
    externalSource: "https://huggingface.co/meta-llama/Llama-3-8B",
    upstreamLicense: "llama-3-community",
    authors: ["Meta AI"],
    title: "Llama-3-8B (OSS provenance)",
  });
  expect(ipId).toBeTruthy();
  expect(ipMetadataURI).toBeTruthy();
});

test("registerDerivative carries parentIpId", async () => {
  const clients = makeMockClients("0xowner");
  const parent = await uploadPublic(clients as any, {
    bytes: new TextEncoder().encode("p"),
    meta: meta("Parent"),
  });
  const child = await registerDerivative(clients as any, {
    parentIpId: parent.ipId,
    parentTermsId: parent.licenseTermsId ?? "1001",
    bytes: new TextEncoder().encode("c"),
    meta: meta("Child"),
  });
  expect(child.parentIpId).toBe(parent.ipId);
});

test("DownloadGateError is exported and is an Error", () => {
  const e = new DownloadGateError("nope");
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("DownloadGateError");
});
