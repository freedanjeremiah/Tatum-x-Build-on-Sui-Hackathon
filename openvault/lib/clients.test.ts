import { test, expect } from "vitest";
import { makeMockClients } from "./mock/story";

test("mock gated round-trip: upload then download returns same bytes", async () => {
  const { cdr } = makeMockClients("0xowner");
  const ipId = "0xabc" as const;
  const bytes = new TextEncoder().encode("secret weights");
  const { uuid } = await cdr.uploader.uploadFile({ content: bytes, readConditionData: ipId } as any);
  const tokenId = await cdr.__mintFor(ipId);
  const out = await cdr.consumer.downloadFile({ uuid, accessAuxData: tokenId } as any);
  expect(new TextDecoder().decode(out.content)).toBe("secret weights");
});

test("mock gated download without token reverts", async () => {
  const { cdr } = makeMockClients("0xowner");
  const { uuid } = await cdr.uploader.uploadFile({ content: new Uint8Array([1]), readConditionData: "0xip" } as any);
  await expect(cdr.consumer.downloadFile({ uuid, accessAuxData: "0x" } as any)).rejects.toThrow();
});
