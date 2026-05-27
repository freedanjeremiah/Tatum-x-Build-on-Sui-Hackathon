import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
p.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 240)));
p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 240)));
p.on("response", (r) => { const u = r.url(); if (/privy|wasm|cdr/i.test(u)) console.log(`[resp ${r.status()}]`, u.slice(0, 120)); });
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
// poll the wallet button text for up to 18s
for (let i = 0; i < 9; i++) {
  await p.waitForTimeout(2000);
  const btn = await p.locator("header button, header span").last().textContent().catch(() => "");
  const hasConnect = await p.locator("button", { hasText: /^connect$/i }).count();
  console.log(`t=${(i + 1) * 2}s  lastHeaderCtl="${(btn || "").trim().slice(0, 20)}"  connectBtns=${hasConnect}`);
  if (hasConnect) break;
}
await b.close();
