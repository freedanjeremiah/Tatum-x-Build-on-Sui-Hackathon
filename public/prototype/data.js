/* ============================================================
   OPENVAULT — mock testnet data (Aeneid chain 1315)
   Exposed on window.OV
   ============================================================ */
(function () {
  // tier definitions — single source (mirrors lib/tiers.ts)
  const TIERS = {
    public:  { key: 'public',  label: 'Public',  color: 'var(--tier-public)',  blurb: 'Open / safe',      glyph: 'arrow',   license: 'Commercial · license attached', cta: 'Download' },
    private: { key: 'private', label: 'Private', color: 'var(--tier-private)', blurb: 'Locked / personal', glyph: 'lock',    license: 'Owner only', cta: 'Owner only' },
    gated:   { key: 'gated',   label: 'Gated',   color: 'var(--tier-gated)',   blurb: 'Licensed / paid',  glyph: 'lock',    license: 'Commercial · mint to unlock', cta: 'Mint to unlock' },
    group:   { key: 'group',   label: 'Group',   color: 'var(--tier-group)',   blurb: 'Shared / pool',    glyph: 'group',   license: 'Group license · subscribe', cta: 'View group' },
    compute: { key: 'compute', label: 'Compute', color: 'var(--tier-compute)', blurb: 'Computable, not downloadable', glyph: 'compute', license: 'Compute license · pay per job', cta: 'Run a job' },
  };

  const ALGOS = [
    { name: 'Mean aggregate',        hash: 'sha256:mean-aggregate' },
    { name: 'Logistic regression',   hash: 'sha256:logistic-regression' },
  ];

  // helper: deterministic-ish 0x hash
  function hx(seed, len) {
    len = len || 40;
    const chars = '0123456789abcdef';
    let x = (((seed >>> 0) * 2654435761) >>> 0) ^ 0x9e3779b9;
    if (x === 0) x = 0x12345678;
    let s = '0x';
    for (let i = 0; i < len; i++) {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;  x >>>= 0;
      s += chars[x & 15];
    }
    return s;
  }

  const A = [
    {
      ipId: hx(11), tier: 'public', modality: 'dataset',
      title: 'OpenWebText — Aeneid Shards',
      description: 'A deduplicated 38B-token web corpus, sharded and pinned in the clear. Provenance registered on Story so every downstream model can cite the exact snapshot.',
      tags: ['language', 'pretraining', 'web', 'en'],
      licenseTermsId: '2401', parentIpId: null, groupId: null,
      createdTx: hx(110, 64), vaultUuid: '4471', cid: 'bafybeics7n…ovkq',
      computeEnabled: false, score: 9412,
    },
    {
      ipId: hx(12), tier: 'gated', modality: 'model',
      title: 'Helix-7B Instruct',
      description: 'Instruction-tuned 7B decoder, threshold-encrypted on IPFS. The license token is the decryption credential — mint to unlock the weights.',
      tags: ['llm', 'instruct', '7b', 'commercial'],
      licenseTermsId: '2553', parentIpId: hx(11), groupId: null,
      createdTx: hx(120, 64), vaultUuid: '5546', cid: 'bafybeih9d2…m3qa',
      computeEnabled: false, fee: '5.0', revShare: '8', score: 8821,
    },
    {
      ipId: hx(13), tier: 'compute', modality: 'dataset',
      title: 'MIMIC-Vitals Confidential Cohort',
      description: 'De-identified ICU vitals from 41k stays. Never downloadable — run an allowlisted aggregate inside the worker and receive metrics only.',
      tags: ['health', 'time-series', 'confidential', 'icu'],
      licenseTermsId: '2553', computeLicenseTermsId: '2553', parentIpId: null, groupId: null,
      createdTx: hx(130, 64), vaultUuid: '6102', cid: 'bafybeif0kk…7t2a',
      computeEnabled: true, allowedAlgoHashes: ['sha256:mean-aggregate', 'sha256:logistic-regression'],
      fee: '2.5', revShare: '12', score: 7740,
    },
    {
      ipId: hx(14), tier: 'group', modality: 'model',
      title: 'BioAtlas — Protein Family',
      description: 'A bundle of three structure-prediction checkpoints sharing one provenance root. Subscribe to the family to unlock every member vault.',
      tags: ['protein', 'structure', 'bio', 'ensemble'],
      licenseTermsId: '2610', parentIpId: null, groupId: 'grp-bioatlas',
      createdTx: hx(140, 64), vaultUuid: '6650', cid: 'bafybeibax2…p1 qe'.replace(' ',''),
      computeEnabled: false, score: 6975,
    },
    {
      ipId: hx(15), tier: 'private', modality: 'dataset',
      title: 'Internal RLHF Preference Set',
      description: 'Human preference pairs collected in-house. Sealed to the owner key; decryptable by the owner only. Listed for provenance, not access.',
      tags: ['rlhf', 'preference', 'internal'],
      licenseTermsId: null, parentIpId: null, groupId: null,
      createdTx: hx(150, 64), vaultUuid: '6711', cid: 'bafybeid7uu…9kza',
      computeEnabled: false, score: 4120,
    },
    {
      ipId: hx(16), tier: 'public', modality: 'model',
      title: 'Tone-Small ASR',
      description: 'A 120M-param streaming speech recogniser. Open weights, attached commercial license, derived from the OpenWebText-Aeneid lineage for its text head.',
      tags: ['asr', 'speech', 'streaming', 'small'],
      licenseTermsId: '2401', parentIpId: hx(11), groupId: null,
      createdTx: hx(160, 64), vaultUuid: '6820', cid: 'bafybeicc4r…lm0a',
      computeEnabled: false, score: 6610,
    },
    {
      ipId: hx(17), tier: 'gated', modality: 'dataset',
      title: 'StreetView-JP Panoramas',
      description: 'Geo-tagged street panoramas across 12 Japanese cities. License-gated for commercial mapping use; mint to receive the decryption credential.',
      tags: ['vision', 'geo', 'panorama', 'jp'],
      licenseTermsId: '2553', parentIpId: null, groupId: null,
      createdTx: hx(170, 64), vaultUuid: '6904', cid: 'bafybeig22h…84ra',
      computeEnabled: false, fee: '3.0', revShare: '10', score: 5980,
    },
    {
      ipId: hx(18), tier: 'compute', modality: 'dataset',
      title: 'CreditRisk Confidential Ledger',
      description: 'Anonymised lending records. Compute-only: train a logistic model in-enclave-equivalent and export coefficients — no individual rows ever leave.',
      tags: ['finance', 'tabular', 'confidential', 'risk'],
      licenseTermsId: '2553', computeLicenseTermsId: '2553', parentIpId: null, groupId: null,
      createdTx: hx(180, 64), vaultUuid: '7011', cid: 'bafybeih8ll…q5wa',
      computeEnabled: true, allowedAlgoHashes: ['sha256:mean-aggregate', 'sha256:logistic-regression'],
      fee: '4.0', revShare: '15', score: 6240,
    },
    {
      ipId: hx(19), tier: 'public', modality: 'dataset',
      title: 'Halftone-160 Vector Swatches',
      description: 'A reference corpus of 160 vector halftone fields with labelled dot-pitch and angle. Public, freely downloadable, provenance on-chain.',
      tags: ['vector', 'halftone', 'design', 'reference'],
      licenseTermsId: '2401', parentIpId: null, groupId: null,
      createdTx: hx(190, 64), vaultUuid: '7120', cid: 'bafybeid0sw…tt9a',
      computeEnabled: false, score: 3510,
    },
    {
      ipId: hx(20), tier: 'gated', modality: 'model',
      title: 'Helix-7B · Legal Adapter',
      description: 'A LoRA adapter over Helix-7B Instruct for contract review. Derivative IP — royalties route upstream to the base model on every mint.',
      tags: ['lora', 'legal', 'adapter', '7b'],
      licenseTermsId: '2553', parentIpId: hx(12), groupId: null,
      createdTx: hx(200, 64), vaultUuid: '7233', cid: 'bafybeifr3a…0c1a',
      computeEnabled: false, fee: '6.0', revShare: '9',
      externalSource: 'https://huggingface.co/datasets/legal-contracts-oss',
      score: 5320,
    },
    {
      ipId: hx(21), tier: 'group', modality: 'dataset',
      title: 'BioAtlas — Sequence Pool',
      description: 'The sequence half of the BioAtlas family. Gated per-IP today; group-license member unlock is an open CDR spec item.',
      tags: ['protein', 'sequence', 'bio'],
      licenseTermsId: '2610', parentIpId: null, groupId: 'grp-bioatlas',
      createdTx: hx(210, 64), vaultUuid: '7340', cid: 'bafybeibss1…p0ma',
      computeEnabled: false, score: 4980,
    },
    {
      ipId: hx(22), tier: 'public', modality: 'model',
      title: 'Tone-Tiny Embeddings',
      description: 'A 22M-param sentence embedding model. Open weights with attached commercial license — the lightest member of the Tone family.',
      tags: ['embeddings', 'retrieval', 'tiny'],
      licenseTermsId: '2401', parentIpId: hx(16), groupId: null,
      createdTx: hx(220, 64), vaultUuid: '7451', cid: 'bafybeic9zz…re4a',
      computeEnabled: false, score: 2890,
    },
  ];

  const GROUPS = {
    'grp-bioatlas': {
      groupId: 'grp-bioatlas',
      title: 'BioAtlas Family',
      description: 'A provenance pool of protein structure & sequence artifacts sharing one royalty root. One subscription is intended to unlock every member vault.',
      ipId: hx(140, 40),
      createdTx: hx(141, 64),
      licenseTermsId: '2610',
      memberGroupId: 'grp-bioatlas',
    },
  };

  // a canned compute-job result for the done state
  const COMPUTE_DONE = {
    status: 'done',
    metrics: { rows_seen: '41,008', mean_hr: '86.4', auc: '0.791', n_features: '12' },
    resultIpId: hx(901), resultTx: hx(902, 64),
    isolationMode: 'plain-server', decryptCalled: true, scratchCleared: true,
    licenseTokenId: '88123', metricsUri: 'ipfs://bafybeih…mtr9',
    warning: null,
  };
  const COMPUTE_REJECTED = {
    status: 'rejected',
    reason: 'Requested algorithm hash is not on the artifact allowlist.',
    decryptCalled: false,
  };

  window.OV = {
    TIERS, ALGOS, ARTIFACTS: A, GROUPS, COMPUTE_DONE, COMPUTE_REJECTED, hx,
    NETWORK: 'AENEID TESTNET', CHAIN: 1315,
    WALLET: '0x29bc7A41d0E5b2F8a6C4eD9b0a17F2c3D9a83C50',
    EXPLORER_IPA: 'https://aeneid.explorer.story.foundation/ipa/',
    EXPLORER_TX: 'https://aeneid.storyscan.io/tx/',
    find: function (ipId) { return A.find(function (a) { return a.ipId === ipId; }); },
  };
})();
