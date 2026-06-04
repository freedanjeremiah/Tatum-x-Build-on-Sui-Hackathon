import { describe, it, expect } from "vitest";
import { isolationDisclosure } from "./attestation";

describe("isolationDisclosure", () => {
  it("reports the real Nitro enclave with the on-chain verify tx", () => {
    const s = isolationDisclosure({
      validatorAttestationEnabled: false,
      enforced: false,
      untrustedValidators: 0,
      workerIsolation: "enclave-nautilus",
      attestationTx: "0xabc",
    });
    expect(s).toContain("AWS Nitro enclave");
    expect(s).toContain("verified on-chain");
    expect(s).toContain("0xabc");
  });
});
