# OpenVault — Custom CDR Read-Condition Contracts

Custom on-chain access conditions for CDR vaults, built for the **CDR Hackathon
Technical Implementation track** ("advanced read/write conditions, composable
vault systems, trustless data exchange using CDR vaults").

CDR gates each vault read on a condition contract it staticcalls:

```solidity
function checkReadCondition(uint32 label, bytes accessAuxData, bytes readConditionData, address caller)
    external view returns (bool);
```

(signature recovered from Story Aeneid's deployed `LicenseReadCondition`
`0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3`.)

These three contracts turn two of OpenVault's previously-faked behaviors into real
on-chain enforcement, and add a generic composition primitive.

## Contracts (deployed on Story Aeneid, chain 1315)

| Contract | Address | Purpose |
|---|---|---|
| `AnyOfReadCondition` | `0x97820c14c861d8be1fc7b17a4cb5335312383c8a` | Composable OR over any sub-conditions: a vault unlocks if *any* listed condition passes (`license OR token-balance OR merkle…`). |
| `GroupLicenseReadCondition` | `0x58fbf091fedfe898465c1fbef7588a3f7e7128df` | One license for **any** member IP of a group unlocks **every** member's vault. Resolves SPEC §8.7. Composes the audited `LicenseReadCondition` per member — no re-implementation of license validation. |
| `ComputeWorkerReadCondition` | `0x834c06ba613481401df4972a746ddd529b97b5c2` | Compute-tier vaults decrypt **only** for an allowlisted confidential-compute worker — a consumer's read reverts. Real "computable, not downloadable" (SPEC §C4/§C9). |

## Why these (design)

- **Composition over re-implementation.** `AnyOf` and `GroupLicense` *staticcall*
  existing condition contracts and OR the results, so they inherit the audited
  license-validation logic and stay tiny + safe. This is the "composable vault"
  idea made literal.
- **Enforcement at the CDR layer, not the app.** `ComputeWorkerReadCondition`
  makes the no-download guarantee a property of the vault, not the UI: only the
  worker operator address satisfies the gate.

## Build / deploy / verify

No Foundry required — compiled with the `solc` npm package and deployed via viem:

```
node --env-file=.env.local scripts/contracts/deploy.mjs
```

writes `scripts/contracts/deployed.json`. All three were verified live on Aeneid
via `eth_call` to `checkReadCondition` (ComputeWorker: operator→true,
consumer→false; Group: graceful false with no license, no revert).

## Integration

- `lib/constants.ts` — deployed addresses + `COMPUTE_WORKER_OPERATOR`.
- `lib/artifacts.ts` `uploadCompute` — gates the vault with
  `ComputeWorkerReadCondition`.
- `worker/compute-worker.ts` — decrypts as the allowlisted operator
  (`accessAuxData = "0x"`); no per-read license mint (also removes a double-mint).
- `lib/group.ts` `groupReadCondition(memberIpIds)` — builds the
  `GroupLicenseReadCondition` read-condition for a group-gated vault.
- `scripts/09-group-unlock.ts` — end-to-end proof of §8.7 (a member license
  unlocks a different IP's group-gated vault).
