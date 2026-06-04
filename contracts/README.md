# Reef — Access Conditions (migrated to Move)

> **This directory's Solidity read-condition contracts have been removed.** Reef
> migrated from EVM/CDR vaults + custom `IReadCondition` staticcalls to a single
> **Sui Move** module with **Seal** threshold encryption. The on-chain access
> policy now lives in:
>
> **`move/sources/reef.move`** (`module reef::registry`)

## What replaced the Solidity contracts

On EVM, each CDR vault read was gated by a staticcall to a condition contract:

```solidity
function checkReadCondition(uint32 label, bytes accessAuxData, bytes readConditionData, address caller)
    external view returns (bool);
```

On Sui, there is no staticcall gate. Each artifact is its own shared
`ArtifactRegistry` object carrying a `tier: u8`, and a Seal key server **dry-runs**
`registry::seal_approve(id, registry, ctx)` with the requester's address as sender.
An **abort means DENY** (fail closed). The five old read-conditions map directly to
the five tiers + `seal_approve` branches:

| Old Solidity read-condition | Move tier (`tier: u8`) | `seal_approve` rule |
|---|---|---|
| `OwnerReadCondition` | `1` private-owner | `sender == owner` |
| `LicenseReadCondition` | `2` gated-license | `owner OR license_holders.contains(sender)` |
| `GroupLicenseReadCondition` | `3` group | `owner OR license_holders.contains(sender)` (group bound via `group_id`) |
| `ComputeWorkerReadCondition` | `4` compute | `compute_workers.contains(sender)` **only** — owner/consumer denied ("computable, not downloadable") |
| `AnyOfReadCondition` | — | composition is expressed by tier choice + on-chain `license_holders`/`compute_workers` sets; no generic OR contract is needed |
| (open / no condition) | `0` public | always allow |

Tier binding is enforced cryptographically: the 64-byte Seal `id` is
`artifactObjectId(32) ++ blake2b256(utf8(tierLabel))(32)`, so a ciphertext sealed
for one tier cannot be decrypted under another (see `seal_approve`'s
`has_id_prefix` / `has_tier_suffix` checks).

## Build / test

```
sui move build      # from the move/ package root
sui move test
```

## Integration (Sui + Walrus + Seal)

- `lib/registry.ts` — `RegistryClient`: `register` / `registerDerivative`,
  `addLicenseHolder` / `buyLicense`, `addComputeWorker`, `setGroup`,
  `createGroup` / `addMember`, `payRoyalty` / `claimRevenue`, `raiseDispute` /
  `counterDispute`, and `buildSealApproveTx` (the decrypt gate).
- `lib/artifacts.ts` — `uploadPublic/Private/Gated/Compute`, `registerDerivative`,
  `download` (Seal-decrypt; compute tier has no download path).
- `lib/crypto.ts` — Seal identity (`sealIdBytes`) + `seal_approve` tx builder.
- `lib/storage.ts` — Walrus publish/read of the ciphertext blob.
- `worker/compute-worker.ts` — decrypts as the allowlisted compute-worker operator.
- `indexer/listen.ts` — read-model indexer over `reef::registry` events.
