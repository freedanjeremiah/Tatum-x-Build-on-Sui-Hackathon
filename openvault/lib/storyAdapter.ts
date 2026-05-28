// Friendly-name adapter over the real Story core-sdk StoryClient.
//
// The rest of OpenVault (lib/artifacts, scripts, worker) calls a small,
// stable surface — `story.ipAsset.registerIpAsset(...)`,
// `story.ipAsset.registerDerivativeIpAsset(...)`, and pass-throughs for
// license/royalty/dispute/group/wip/nft — and expects NORMALIZED returns of the
// form `{ ipId, tokenId, licenseTermsIds, licenseTermsId, txHash }`.
//
// The real SDK's unified entry points return slightly different shapes (e.g.
// `licenseTermsIds: bigint[]` with no scalar `licenseTermsId`), and the project
// standardized on the `mintAndRegister*` workflows. This adapter maps onto those
// and normalizes the results so callers are agnostic to mock vs real.
//
// Typed `any` where the SDK generics are awkward — the mapping is exact and the
// real shapes are confirmed in node_modules .d.ts (ipAsset.d.ts).

import { WIP_OPTIONS } from "./constants";

export function wrapStory(real: any): any {
  return {
    ipAsset: {
      // nft:{spgNftContract}, licenseTermsData:[{terms}], ipMetadata
      registerIpAsset: async (req: any) => {
        const r = await real.ipAsset.mintAndRegisterIpAssetWithPilTerms({
          spgNftContract: req.nft.spgNftContract,
          licenseTermsData: req.licenseTermsData,
          ipMetadata: req.ipMetadata,
          ...WIP_OPTIONS,
        });
        return {
          ipId: r.ipId,
          tokenId: r.tokenId,
          licenseTermsIds: r.licenseTermsIds,
          licenseTermsId: r.licenseTermsIds?.[0]?.toString(),
          txHash: r.txHash,
        };
      },
      // nft:{spgNftContract}, derivData:{parentIpIds,licenseTermsIds}, ipMetadata
      registerDerivativeIpAsset: async (req: any) => {
        const r = await real.ipAsset.mintAndRegisterIpAndMakeDerivative({
          spgNftContract: req.nft.spgNftContract,
          derivData: req.derivData,
          ipMetadata: req.ipMetadata,
          ...WIP_OPTIONS,
        });
        return {
          ipId: r.ipId,
          tokenId: r.tokenId,
          txHash: r.txHash,
        };
      },
    },

    // Pass-throughs: same method names as the real SDK sub-clients.
    license: real.license,
    royalty: real.royalty,
    dispute: real.dispute,
    groupClient: real.groupClient,
    wipClient: real.wipClient,
    nftClient: real.nftClient,
  };
}
