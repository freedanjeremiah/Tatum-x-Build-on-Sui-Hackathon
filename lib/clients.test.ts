import { test, expect } from "vitest";
import { RUN_INTEGRATION, realClients } from "./itest";

const itInt = test.skipIf(!RUN_INTEGRATION);

itInt("real gated round-trip: upload then download returns same bytes", async () => {
  const clients = await realClients();
  expect(clients).toMatchObject({
    cdr: expect.anything(),
    story: expect.anything(),
    account: expect.anything(),
  });

  const { uploadGated, download } = await import("./artifacts");
  const bytes = new TextEncoder().encode("secret weights");
  const art = await uploadGated(clients as any, {
    bytes,
    meta: {
      title: "Integration gated round-trip",
      description: "Live CDR upload/download round-trip check.",
      tags: ["integration", "gated"],
      creators: [
        { name: "Integration", address: clients.account.address, contributionPercent: 100 },
      ],
      modality: "model",
    },
  });

  const out = await download(clients as any, {
    ipId: art.ipId,
    uuid: art.vaultUuid!,
    licenseTermsId: art.licenseTermsId!,
  });
  expect(new TextDecoder().decode(out)).toBe("secret weights");
});
