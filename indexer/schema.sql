-- OpenVault index-only mirror of PUBLIC on-chain / registry data.
-- This table holds nothing secret: no decryption keys, no plaintext bytes.
-- It exists solely to power browse/search over public artifact metadata.

CREATE TABLE IF NOT EXISTS artifacts (
  ipId                  TEXT PRIMARY KEY,
  tier                  TEXT,
  modality              TEXT,
  title                 TEXT,
  description           TEXT,
  tags                  TEXT,    -- JSON array of strings
  ipMetadataURI         TEXT,
  vaultUuid             INTEGER,
  cid                   TEXT,
  licenseTermsId        TEXT,
  parentIpId            TEXT,
  groupId               TEXT,
  ownerNftTokenId       TEXT,    -- bigint serialized as decimal string
  owner                 TEXT,    -- EOA that registered the IP asset (0x-hex)
  createdTx             TEXT,
  computeEnabled        INTEGER, -- 0 / 1 boolean
  allowedAlgoHashes     TEXT,    -- JSON array of strings
  computeLicenseTermsId TEXT,
  externalSource        TEXT,
  score                 REAL
);
