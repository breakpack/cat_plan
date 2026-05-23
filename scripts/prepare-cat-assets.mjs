/* global console */

import { copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const sourceDir = resolve("catset_assets", "catset_gifs", "cat05_gifs");
const outputDir = resolve(".release-assets", "cat-assets");
const assets = ["cat05_idle_blink_8fps.gif", "cat05_attack_12fps.gif"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

let copied = 0;
for (const asset of assets) {
  const source = resolve(sourceDir, asset);
  if (!existsSync(source)) {
    continue;
  }

  await copyFile(source, resolve(outputDir, asset));
  copied += 1;
}

if (copied === assets.length) {
  console.log(`Prepared ${copied} cat asset files for packaging.`);
} else {
  console.warn("catset_assets was not found. Packaged app will use the built-in mock cat fallback.");
}
