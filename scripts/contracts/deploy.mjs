// Compile (solc 0.8.26) + deploy the OpenVault custom CDR read-condition contracts
// to Story Aeneid, using the funded WALLET_PRIVATE_KEY. Prints addresses + writes
// scripts/contracts/deployed.json.
//
// Run: node --env-file=.env.local scripts/contracts/deploy.mjs
//   (env preload needed so WALLET_PRIVATE_KEY is present)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");
const { createWalletClient, createPublicClient, http, defineChain } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = join(HERE, "..", "..", "contracts");
const RPC_URL = "https://aeneid.storyrpc.io";

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// --- compile -------------------------------------------------------------
const files = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".sol"));
const sources = {};
for (const f of files) sources[f] = { content: readFileSync(join(CONTRACTS_DIR, f), "utf8") };

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

// Resolve relative imports like "./IReadCondition.sol" against the sources map.
function findImports(path) {
  const key = path.replace(/^\.\//, "");
  if (sources[key]) return { contents: sources[key].content };
  return { error: "File not found: " + path };
}

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === "error");
if (errors.length) {
  console.error("Solidity compile errors:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}

function artifact(file, name) {
  const c = out.contracts[file][name];
  return { abi: c.abi, bytecode: ("0x" + c.evm.bytecode.object) };
}

const TO_DEPLOY = [
  ["AnyOfReadCondition.sol", "AnyOfReadCondition"],
  ["GroupLicenseReadCondition.sol", "GroupLicenseReadCondition"],
  ["ComputeWorkerReadCondition.sol", "ComputeWorkerReadCondition"],
  ["OwnerReadCondition.sol", "OwnerReadCondition"],
];

// --- deploy --------------------------------------------------------------
const pk = process.env.WALLET_PRIVATE_KEY;
if (!pk) {
  console.error("WALLET_PRIVATE_KEY not set — run with: node --env-file=.env.local scripts/contracts/deploy.mjs");
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : "0x" + pk);
const wallet = createWalletClient({ account, chain: aeneid, transport: http(RPC_URL) });
const pub = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });

console.log("deployer:", account.address);
const deployed = {};
for (const [file, name] of TO_DEPLOY) {
  const { abi, bytecode } = artifact(file, name);
  process.stdout.write(`deploying ${name} ... `);
  const hash = await wallet.deployContract({ abi, bytecode, args: [] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  deployed[name] = receipt.contractAddress;
  console.log(receipt.contractAddress, `(tx ${hash})`);
}

// Merge with any prior deployment so re-runs add new contracts without losing the old ones.
const outPath = join(HERE, "deployed.json");
let prior = {};
try { prior = JSON.parse(readFileSync(outPath, "utf8")); } catch {}
writeFileSync(outPath, JSON.stringify({ ...prior, ...deployed }, null, 2) + "\n");
console.log("\nwrote scripts/contracts/deployed.json");
console.log({ ...prior, ...deployed });
