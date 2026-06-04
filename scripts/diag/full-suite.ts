// Full functionality suite — exercises every OpenVault flow end-to-end against
// the live Aeneid testnet. Each step prints a tx hash + outcome.
//
// Tests:
//   1.  uploadPublic                → real public IP + pinned bytes
//   2.  uploadGated                 → real gated IP + sealed vault
//   3.  uploadPrivate               → real private IP + owner-only vault
//   4.  uploadCompute               → real compute IP + ComputeWorkerReadCondition vault
//   5.  download(gated, mint=true)  → real license mint + decrypt + return plaintext
//   6.  download(private, mint=false) → owner decrypt of owner-only vault
//   7.  runComputeJob               → worker decrypts, aggregates, registers derivative
//   8.  payRoyalty                  → consumer pays royalties to compute child
//   9.  getClaimable + claimRevenue → owner reads + claims revenue
//   10. raiseReport                 → real dispute against the public IP
//   11. counterDispute              → real counter-evidence assertion
//   12. createGroup                 → real group ipId with members
//   13. distribute                  → real even-split distribution tx
//
// Run: pnpm real scripts/diag/full-suite.ts

import { getClients } from "../_util";
import {
  uploadPublic,
  uploadGated,
  uploadPrivate,
  uploadCompute,
  download,
  type Clients,
} from "../../lib/artifacts";
import { runComputeJob } from "../../worker/compute-worker";
import { payRoyalty, claimRevenue, getClaimable } from "../../lib/royalty";
import {
  freshEvidenceCid,
  raiseReport,
  counterDispute,
} from "../../lib/dispute";
import { createGroup, distribute } from "../../lib/group";

const ALLOWED = ["sha256:mean-aggregate", "sha256:logistic-regression"];

interface StepResult {
  step: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail?: string;
}

async function run<T>(
  name: string,
  fn: () => Promise<T>,
  results: StepResult[],
): Promise<T | undefined> {
  console.log(`\n=== ${name} ===`);
  try {
    const out = await fn();
    results.push({ step: name, status: "PASS" });
    return out;
  } catch (e) {
    const msg = (e as Error).message;
    console.error("  FAILED:", msg.slice(0, 240));
    results.push({ step: name, status: "FAIL", detail: msg.slice(0, 200) });
    return undefined;
  }
}

async function main() {
  const results: StepResult[] = [];

  const clients = await getClients();
  const owner = clients.account.address as `0x${string}`;
  console.log("operator:", owner);

  // MIST helpers (Sui royalties are SUI/MIST, not WIP/wei).
  const MIST_PER_SUI = 1_000_000_000n;

  // 1. uploadPublic — pinned cleartext.
  const publicArt = await run(
    "uploadPublic",
    async () => {
      const a = await uploadPublic(clients as unknown as Clients, {
        bytes: new TextEncoder().encode("public dataset bytes"),
        meta: {
          title: "FULL-SUITE-public",
          description: "Public artifact for full-suite test.",
          tags: ["fullsuite", "public"],
          creators: [{ name: "FS", address: owner, contributionPercent: 100 }],
          modality: "dataset",
        },
      });
      console.log("  ipId:", a.ipId, "cid:", a.cid);
      return a;
    },
    results,
  );

  // 2. uploadGated — sealed vault, license-token gated.
  const gatedArt = await run(
    "uploadGated",
    async () => {
      const a = await uploadGated(clients as unknown as Clients, {
        bytes: new TextEncoder().encode("gated model weights"),
        meta: {
          title: "FULL-SUITE-gated",
          description: "Gated artifact for full-suite test.",
          tags: ["fullsuite", "gated"],
          creators: [{ name: "FS", address: owner, contributionPercent: 100 }],
          modality: "model",
        },
        terms: { rev: 5, fee: 1n },
      });
      console.log("  ipId:", a.ipId, "vault:", a.vaultUuid, "terms:", a.licenseTermsId);
      return a;
    },
    results,
  );

  // 3. uploadPrivate — owner-only vault.
  const privateArt = await run(
    "uploadPrivate",
    async () => {
      const a = await uploadPrivate(clients as unknown as Clients, {
        bytes: new TextEncoder().encode("private notes"),
        meta: {
          title: "FULL-SUITE-private",
          description: "Private artifact for full-suite test.",
          tags: ["fullsuite", "private"],
          creators: [{ name: "FS", address: owner, contributionPercent: 100 }],
          modality: "dataset",
        },
      });
      console.log("  ipId:", a.ipId, "vault:", a.vaultUuid);
      return a;
    },
    results,
  );

  // 4. uploadCompute — ComputeWorkerReadCondition vault.
  const computeArt = await run(
    "uploadCompute",
    async () => {
      const a = await uploadCompute(clients as unknown as Clients, {
        bytes: new TextEncoder().encode(JSON.stringify({ values: [1, 2, 3, 4, 5] })),
        meta: {
          title: "FULL-SUITE-compute",
          description: "Compute artifact for full-suite test.",
          tags: ["fullsuite", "compute"],
          creators: [{ name: "FS", address: owner, contributionPercent: 100 }],
          modality: "dataset",
        },
        terms: { rev: 5, fee: 1n },
        allowedAlgoHashes: ALLOWED,
      });
      console.log("  ipId:", a.ipId, "vault:", a.vaultUuid);
      return a;
    },
    results,
  );

  // 5. download (gated) — the owner passes seal_approve's gated branch and decrypts.
  if (gatedArt) {
    await run(
      "download (gated, owner decrypt)",
      async () => {
        const bytes = await download(clients as unknown as Clients, {
          ipId: gatedArt.ipId,
          cid: gatedArt.cid,
          tier: "gated",
        });
        const text = new TextDecoder().decode(bytes);
        console.log("  decrypted:", text);
      },
      results,
    );
  }

  // 6. download (private) — owner decrypts the owner-only artifact.
  if (privateArt) {
    await run(
      "download (private, owner)",
      async () => {
        const bytes = await download(clients as unknown as Clients, {
          ipId: privateArt.ipId,
          cid: privateArt.cid,
          tier: "private",
        });
        const text = new TextDecoder().decode(bytes);
        console.log("  decrypted:", text);
      },
      results,
    );
  }

  // 7. runComputeJob — full worker path.
  let computeResult: Awaited<ReturnType<typeof runComputeJob>> | undefined;
  if (computeArt) {
    computeResult = await run(
      "runComputeJob",
      async () => {
        const r = await runComputeJob({
          datasetIpId: computeArt.ipId,
          algoHash: "sha256:mean-aggregate",
          allowedAlgoHashes: ALLOWED,
          dataset: computeArt,
          clients: clients as unknown as Clients,
        });
        console.log("  status:", r.status, "metrics:", JSON.stringify(r.metrics));
        console.log("  resultIpId:", r.resultIpId, "tx:", r.resultTx);
        console.log("  attestation.workerIsolation:", r.attestation?.workerIsolation, "simVerified:", r.attestation?.simVerified);
        if (r.status !== "done") throw new Error(`status=${r.status} reason=${r.reason}`);
        return r;
      },
      results,
    );
  }

  // 8. payRoyalty — pay royalties into the compute derivative's vault, routing
  // 100% up to the compute parent (so the parent accrues claimable revenue).
  if (computeResult?.resultIpId) {
    await run(
      "payRoyalty (0.05 SUI → compute derivative, routed up)",
      async () => {
        const r = await payRoyalty(clients, computeResult!.resultIpId!, MIST_PER_SUI / 20n, {
          parentSharePct: 100,
        });
        console.log("  tx:", r.parentTxHash ?? r.txHash);
      },
      results,
    );
  }

  // 9. getClaimable + claimRevenue — owner reads + claims on the compute parent.
  if (computeArt && computeResult?.resultIpId) {
    await run(
      "getClaimable + claimRevenue",
      async () => {
        const claimable = await getClaimable(clients, computeArt!.ipId);
        console.log("  claimable on parent:", claimable.toString(), "MIST");
        if (claimable > 0n && computeArt!.capId) {
          const r = await claimRevenue(clients, computeArt!.ipId, computeArt!.capId);
          console.log("  claim tx:", r.txHash);
        } else {
          console.log("  nothing to claim (vault empty)");
        }
      },
      results,
    );
  }

  // 10. raiseReport — real dispute against the public IP.
  let raised: Awaited<ReturnType<typeof raiseReport>> | undefined;
  if (publicArt) {
    raised = await run(
      "raiseReport (IMPROPER_REGISTRATION)",
      async () => {
        const cid = freshEvidenceCid("FullSuite");
        const r = await raiseReport(clients, publicArt!.ipId, cid, "IMPROPER_REGISTRATION");
        console.log("  disputeId:", r.disputeId, "tx:", r.txHash);
        return r;
      },
      results,
    );
  }

  // 11. counterDispute — counter the assertion (we are the target owner).
  if (publicArt && raised) {
    await run(
      "counterDispute (counter-evidence)",
      async () => {
        const counterCid = freshEvidenceCid("Counter");
        const r = await counterDispute(clients, publicArt!.ipId, counterCid);
        console.log("  counterCid:", r.cid, "tx:", r.txHash);
      },
      results,
    );
  }

  // 12. createGroup — upload one MORE gated member with identical terms and
  // bind both gated artifacts as members. Using two gated IPs eliminates the
  // ambiguity that a compute IP's license-terms attachment differs from the
  // gated IP's; that ambiguity is what trips the group contract.
  const gated2 = await run(
    "uploadGated (group member 2)",
    async () => {
      const a = await uploadGated(clients as unknown as Clients, {
        bytes: new TextEncoder().encode("gated weights 2"),
        meta: {
          title: "FULL-SUITE-gated-2",
          description: "Second gated artifact for group test.",
          tags: ["fullsuite", "gated"],
          creators: [{ name: "FS", address: owner, contributionPercent: 100 }],
          modality: "model",
        },
        terms: { rev: 5, fee: 1n },
      });
      console.log("  ipId:", a.ipId, "terms:", a.licenseTermsId);
      return a;
    },
    results,
  );

  let group: Awaited<ReturnType<typeof createGroup>> | undefined;
  if (gatedArt && gated2) {
    group = await run(
      "createGroup",
      async () => {
        const r = await createGroup(clients, [gatedArt.ipId, gated2.ipId]);
        console.log("  groupId:", r.groupId, "tx:", r.txHash);
        return r;
      },
      results,
    );
  }

  // 13. distribute — realize each member's own royalty vault (Sui has no shared
  // even-split pool; distribute owner-claims each member with its ArtifactCap).
  if (group && gatedArt && gated2 && gatedArt.capId && gated2.capId) {
    await run(
      "distribute group royalties",
      async () => {
        const r = await distribute(clients, [
          { artifactId: gatedArt.ipId, capId: gatedArt.capId! },
          { artifactId: gated2.ipId, capId: gated2.capId! },
        ]);
        console.log("  totalClaimed:", r.totalClaimed.toString(), "MIST");
      },
      results,
    );
  }

  // Summary
  console.log("\n========== SUMMARY ==========");
  for (const r of results) {
    const tag = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "·";
    console.log(`${tag} ${r.status.padEnd(4)} ${r.step}${r.detail ? "  — " + r.detail : ""}`);
  }
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n${pass}/${results.length} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
