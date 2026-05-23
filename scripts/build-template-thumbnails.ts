/**
 * Builds static PNG thumbnails for every `available: true` resume template
 * by rendering a fixture profile through the real render pipeline + screenshotting
 * with headless Chromium.
 *
 * Output: public/templates/thumbnails/<templateId>.png  (e.g. T01.png)
 *
 * Run: `set -a && source .env.local && set +a && npx tsx scripts/build-template-thumbnails.ts`
 * Re-run whenever a template's theme file changes.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { renderResume } from "../src/lib/resume/render";
import { buildRenderInput } from "../src/lib/resume/profile-mapper";
import { getAvailableTemplates } from "../src/lib/resume/templates/registry";
import { FIXTURE_PROFILE } from "../src/lib/resume/__fixtures__/profile";

async function main() {
  const outDir = path.join(process.cwd(), "public/templates/thumbnails");
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 850, height: 1100 }, deviceScaleFactor: 2 });

  const templates = getAvailableTemplates();
  console.log(`Rendering ${templates.length} templates → ${outDir}`);

  for (const tpl of templates) {
    process.stdout.write(`  ${tpl.id} (${tpl.name})… `);
    const input = buildRenderInput(FIXTURE_PROFILE, { templateId: tpl.id, pageTarget: 1 });
    const result = renderResume(input);

    await page.setContent(result.html, { waitUntil: "load" });
    // Wait for fonts to load
    await page.evaluate(() => (document as Document).fonts.ready);
    const pngBuffer = await page.screenshot({ type: "png", fullPage: true });

    const outFile = path.join(outDir, `${tpl.id}.png`);
    await writeFile(outFile, pngBuffer);
    console.log(`${(pngBuffer.length / 1024).toFixed(1)} KB`);
  }

  await browser.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
