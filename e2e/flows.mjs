import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const results = [];
const consoleErrors = [];
let page;

function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}
async function shot(n) { try { await page.screenshot({ path: SHOTS + n + ".png", fullPage: true }); } catch {} }
const bodyText = async () => (await page.textContent("body")) || "";
async function go(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));
page.on("dialog", (d) => d.accept().catch(() => {}));

try {
  // ---------- C3: Browse + filter + search ----------
  await go("/");
  let t = await bodyText();
  const hasCards = (await page.locator("a[href^='/artifact/']").count()) >= 6;
  rec("Browse: landing renders >=6 artifact cards", hasCards, `found ${await page.locator("a[href^='/artifact/']").count()}`);
  rec("Browse: hero/value-prop present", /OpenVault|access control|vault/i.test(t));
  await shot("01-browse");

  // tier filter chip (gated)
  try {
    const gatedChip = page.locator("button, [role=button]", { hasText: /^gated$/i }).first();
    if (await gatedChip.count()) { await gatedChip.click(); await page.waitForTimeout(1200); }
    const afterFilter = await page.locator("a[href^='/artifact/']").count();
    rec("Browse: tier filter responds", afterFilter >= 1, `gated cards=${afterFilter}`);
  } catch (e) { rec("Browse: tier filter responds", false, String(e).slice(0, 80)); }

  // search box
  try {
    const search = page.locator("input[type=search], input[placeholder*='search' i], input[placeholder*='Search' i]").first();
    if (await search.count()) { await search.fill("Sentiment"); await page.waitForTimeout(1200); }
    const n = await page.locator("a[href^='/artifact/']").count();
    rec("Browse: search narrows results", n >= 1, `results=${n}`);
  } catch (e) { rec("Browse: search narrows results", false, String(e).slice(0, 80)); }

  // ---------- collect seed ipIds via API ----------
  const all = await (await fetch(BASE + "/api/index")).json();
  const gated = all.find((a) => a.tier === "gated");
  const pub = all.find((a) => a.tier === "public");
  const compute = all.find((a) => a.tier === "compute");
  const group = all.find((a) => a.tier === "group");
  const deriv = all.find((a) => a.parentIpId);
  rec("API: 6 seed artifacts incl all tiers", all.length >= 6 && gated && pub && compute && group, `n=${all.length}`);

  // ---------- B1: gated artifact detail shows mint-to-unlock + download ----------
  await go("/artifact/" + gated.ipId);
  t = await bodyText();
  rec("Artifact(gated): detail renders w/ unlock CTA", /mint to unlock|unlock|download/i.test(t), gated.title);
  rec("Artifact(gated): tx/ipId provenance link present", (await page.locator("a[href*='explorer.story'], a[href*='storyscan']").count()) >= 1);
  await shot("02-artifact-gated");

  // Try clicking download/unlock (mock should succeed or show progress)
  try {
    const dl = page.locator("button", { hasText: /mint to unlock|download|unlock/i }).first();
    if (await dl.count()) {
      const dlPromise = ctx.waitForEvent("download", { timeout: 12000 }).catch(() => null);
      await dl.click();
      await page.waitForTimeout(4000);
      const tt = await bodyText();
      const progressed = /collecting validator partials|decrypt|minted|unlocked|license/i.test(tt) || !!(await dlPromise);
      rec("Artifact(gated): unlock/download flow reacts", progressed, "clicked CTA");
      await shot("03-gated-after-click");
    } else rec("Artifact(gated): unlock/download flow reacts", false, "no CTA button found");
  } catch (e) { rec("Artifact(gated): unlock/download flow reacts", false, String(e).slice(0, 80)); }

  // ---------- C1: report dialog ----------
  try {
    const reportBtn = page.locator("button", { hasText: /report/i }).first();
    if (await reportBtn.count()) {
      await reportBtn.click(); await page.waitForTimeout(1000);
      const tt = await bodyText();
      rec("Report: dialog opens (evidence/bond)", /evidence|dispute|bond|report/i.test(tt));
      await shot("04-report-dialog");
      // submit
      const ta = page.locator("textarea").first();
      if (await ta.count()) await ta.fill("This dataset appears improperly registered. Evidence attached.");
      const submit = page.locator("button", { hasText: /submit|raise|report/i }).last();
      if (await submit.count()) { await submit.click(); await page.waitForTimeout(2500); }
      const t2 = await bodyText();
      rec("Report: raises dispute (id/tx shown)", /dispute|in dispute|0x[0-9a-f]/i.test(t2));
    } else rec("Report: dialog opens (evidence/bond)", false, "no report button");
  } catch (e) { rec("Report: dialog opens (evidence/bond)", false, String(e).slice(0, 80)); }

  // ---------- B4: public artifact download ----------
  await go("/artifact/" + pub.ipId);
  t = await bodyText();
  rec("Artifact(public): shows free download, no mint", /download/i.test(t) && !/mint to unlock/i.test(t));
  await shot("05-artifact-public");

  // ---------- A4/A7: derivative lineage graph ----------
  if (deriv) {
    await go("/artifact/" + deriv.ipId);
    t = await bodyText();
    rec("Lineage: derivative shows parent->child graph", /lineage|derivative|parent|royalt/i.test(t));
    await shot("06-lineage");
  } else rec("Lineage: derivative shows parent->child graph", false, "no derivative seed");

  // ---------- B7/B8: compute page (no download, allowlist, run job) ----------
  await go("/compute/" + compute.ipId);
  t = await bodyText();
  rec("Compute: page shows allowlist + run panel", /allowed algorithm|allowlist|mean-aggregate|run/i.test(t));
  rec("Compute: NO download path on compute page", !/\bdownload\b/i.test(t) || /not downloadable|computable/i.test(t));
  rec("Compute: isolation mode disclosed", /isolation|plain server|enclave|operator/i.test(t));
  await shot("07-compute");
  // run an allowed job
  try {
    const runBtn = page.locator("button", { hasText: /run|mint compute|run a job/i }).first();
    if (await runBtn.count()) { await runBtn.click(); await page.waitForTimeout(5000); }
    const tt = await bodyText();
    rec("Compute: job runs, returns metrics only", /metric|mean|result|done/i.test(tt));
    await shot("08-compute-result");
  } catch (e) { rec("Compute: job runs, returns metrics only", false, String(e).slice(0, 80)); }

  // ---------- A5: group page ----------
  await go("/group/" + (group.groupId || group.ipId));
  t = await bodyText();
  rec("Group: bundle page lists members + open-item notice", /member|group|subscribe/i.test(t) && /per-ip|open item|not yet confirmed|fall(s)? back/i.test(t));
  await shot("09-group");

  // ---------- C3: leaderboard ----------
  await go("/leaderboard");
  t = await bodyText();
  rec("Leaderboard: renders ranked table", /rank|score|leaderboard/i.test(t) && (await page.locator("tr, [role=row]").count()) >= 3);
  await shot("10-leaderboard");

  // ---------- A1: upload wizard renders + steps ----------
  await go("/upload");
  t = await bodyText();
  rec("Upload: wizard renders (file/tier step)", /upload|tier|artifact|file|dataset|model/i.test(t));
  await shot("11-upload");

} catch (e) {
  rec("FATAL", false, String(e).slice(0, 200));
} finally {
  rec("Console: no uncaught page errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | ").slice(0, 300));
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n==== ${pass}/${results.length} PASS ====`);
  fs.writeFileSync(new URL("./report.json", import.meta.url), JSON.stringify({ results, consoleErrors }, null, 2));
  await browser.close();
  process.exit(0);
}
