# STORY.md — Reference Index for Claude Code

> All Story + CDR docs and tooling Claude Code should consult. **Fetch the exact page before using a method** — signatures change between releases. Verified set targets `@piplabs/cdr-sdk@0.2.1` + `@story-protocol/core-sdk` on **Aeneid testnet** (June 2026).

## Start here
- Docs index (discover every page): https://docs.story.foundation/llms.txt
- Hackathon hub: https://build.usecdr.dev
- Live CDR demo: https://usecdr.dev
- CDR whitepaper: https://www.story.foundation/blog/confidential-data-rails
- Explorer (IPA): https://aeneid.explorer.story.foundation/ipa/<ipId>
- Storyscan (txs): https://aeneid.storyscan.io

## Agent skill (install into the repo)
- Repo: https://github.com/jacob-tucker/cdr-skill
- Install: `npx skills add jacob-tucker/cdr-skill --skill cdr`
- Skill file: https://github.com/jacob-tucker/cdr-skill/blob/main/skills/cdr/SKILL.md
- 4 example scripts in `src/`: `01-encrypt-text.ts`, `02-encrypt-file.ts`, `03-license-gated.ts`, `04-encrypt-file-supabase.ts`

## CDR SDK (`@piplabs/cdr-sdk`)
- Overview / trust model: https://docs.story.foundation/developers/cdr-sdk/overview
- Setup + client init + quickstart: https://docs.story.foundation/developers/cdr-sdk/setup
- Encrypt & decrypt (secret + file flows): https://docs.story.foundation/developers/cdr-sdk/encrypt-and-decrypt
- IP-asset / license-gated vaults: https://docs.story.foundation/developers/cdr-sdk/ip-asset-vaults
- Runtime config (DKG, apiUrl, threshold): https://docs.story.foundation/developers/cdr-sdk/advanced-configuration
- SDK reference — overview: https://docs.story.foundation/sdk-reference/cdr/overview
- SDK reference — observer (reads, fees, DKG): https://docs.story.foundation/sdk-reference/cdr/observer
- SDK reference — uploader (encrypt + allocate + write): https://docs.story.foundation/sdk-reference/cdr/uploader
- SDK reference — consumer (read + decrypt): https://docs.story.foundation/sdk-reference/cdr/consumer
- SDK reference — crypto (TDH2/ECIES primitives): https://docs.story.foundation/sdk-reference/cdr/crypto

## Story core SDK (`@story-protocol/core-sdk`)
- TS SDK overview: https://docs.story.foundation/developers/typescript-sdk/overview
- TS SDK setup: https://docs.story.foundation/developers/typescript-sdk/setup
- Register an IP Asset (+ metadata + license terms): https://docs.story.foundation/developers/typescript-sdk/register-ip-asset
- Register a Derivative (fine-tune/version): https://docs.story.foundation/developers/typescript-sdk/register-derivative
- Attach terms: https://docs.story.foundation/developers/typescript-sdk/attach-terms
- Mint a license token: https://docs.story.foundation/developers/typescript-sdk/mint-license
- Pay an IPA: https://docs.story.foundation/developers/typescript-sdk/pay-ipa
- Claim revenue: https://docs.story.foundation/developers/typescript-sdk/claim-revenue
- Raise a dispute: https://docs.story.foundation/developers/typescript-sdk/raise-dispute

### Core SDK reference (verified signatures used in SPEC)
- ipAsset (registerIpAsset / registerDerivativeIpAsset): https://docs.story.foundation/sdk-reference/ipasset
- license (mintLicenseTokens, terms): https://docs.story.foundation/sdk-reference/license
- royalty (payRoyaltyOnBehalf, claimAllRevenue, claimableRevenue): https://docs.story.foundation/sdk-reference/royalty
- dispute (raiseDispute, disputeAssertion, disputeIdToAssertionId, tags): https://docs.story.foundation/sdk-reference/dispute
- group (registerGroupAndAttachLicenseAndAddIps, addIpsToGroup, collectAndDistributeGroupRoyalties): https://docs.story.foundation/sdk-reference/group
- nftClient (createNFTCollection): https://docs.story.foundation/sdk-reference/nftclient
- wipClient (deposit/approve — wrap IP→WIP): https://docs.story.foundation/sdk-reference/wipclient
- permissions: https://docs.story.foundation/sdk-reference/permissions

## Concepts (the "why")
- Protocol overview: https://docs.story.foundation/concepts/overview
- IP Asset: https://docs.story.foundation/concepts/ip-asset/overview
- IP Account: https://docs.story.foundation/concepts/ip-asset/ip-account
- IPA metadata standard (model-card schema basis): https://docs.story.foundation/concepts/ip-asset/ipa-metadata-standard
- Licensing module: https://docs.story.foundation/concepts/licensing-module/overview
- License terms / token: https://docs.story.foundation/concepts/licensing-module/license-terms , .../license-token
- PIL flavors: https://docs.story.foundation/concepts/programmable-ip-license/pil-flavors
- Royalty module: https://docs.story.foundation/concepts/royalty-module/overview
- Royalty policies LAP/LRP: https://docs.story.foundation/concepts/royalty-module/liquid-absolute-percentage
- Dispute module + UMA: https://docs.story.foundation/concepts/dispute-module/overview
- Grouping module: https://docs.story.foundation/concepts/grouping-module
- Metadata module: https://docs.story.foundation/concepts/metadata-module
- Deployed smart contracts (all addresses): https://docs.story.foundation/developers/deployed-smart-contracts

## Network
- Aeneid testnet connect (RPC, chainId, faucet): https://docs.story.foundation/network/connect/aeneid

## Verified constants (Aeneid) — also in SPEC §4
```
RPC                  https://aeneid.storyrpc.io
CDR apiUrl           http://172.192.41.96:1317
OwnerWriteCondition  0x4C9bFC96d7092b590D497A191826C3dA2277c34B
LicenseReadCondition 0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3
LicenseToken         0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC
RoyaltyModule        0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086
RoyaltyPolicyLAP     0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E
EvenSplitGroupPool   0xf96f2c30b41Cb6e0290de43C8528ae83d4f33F89
Public SPG (test)    0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc
```

## NOT yet verified (confirm before relying — see SPEC §12)
- `registerIpAsset` exact return field for license terms id → fetch `/sdk-reference/ipasset`
- `mintLicenseTokens` exact response (`licenseTokenIds`?) → fetch `/sdk-reference/license`
- Group-license CDR read-condition encoding → fetch `/concepts/grouping-module` + CDR ip-asset-vaults
- Current min dispute bond → read `OptimisticOracleV3.getMinimumBond()` on-chain
