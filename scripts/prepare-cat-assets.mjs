/* global console */

import { copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve(".release-assets", "cat-assets");
const variants = ["cat01", "cat02", "cat03", "cat04", "cat05"];
const animationNames = ["idle_blink_8fps", "attack_12fps"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

let copied = 0;
const expected = variants.length * animationNames.length;
for (const variant of variants) {
  const sourceDir = resolve("catset_assets", "catset_gifs", `${variant}_gifs`);
  const variantOutputDir = resolve(outputDir, variant);
  await mkdir(variantOutputDir, { recursive: true });

  for (const animationName of animationNames) {
    const asset = `${variant}_${animationName}.gif`;
    const source = resolve(sourceDir, asset);
    if (!existsSync(source)) {
      continue;
    }

    await copyFile(source, resolve(variantOutputDir, asset));
    copied += 1;
  }
}

if (copied === expected) {
  console.log(`Prepared ${copied} cat asset files for packaging.`);
} else {
  console.warn(`Prepared ${copied}/${expected} cat asset files. Missing files will use the built-in mock cat fallback.`);
}
