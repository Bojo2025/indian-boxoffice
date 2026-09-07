#!/usr/bin/env node
/**
 * Pack the Cursor-ready source zip (no node_modules, no sandbox junk).
 * Writes artifacts/indian-box-office-source.zip and public/indian-box-office-source.zip.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const staging = join("/tmp", "indian-box-office-pack");
const zipName = "indian-box-office-source.zip";
const outArtifact = join(root, "artifacts", zipName);
const outPublic = join(root, "public", zipName);

const files = [
  "src",
  "public",
  "migrations",
  "scripts",
  "server",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "eslint.config.mjs",
  "startup.sh",
  "README.md",
  ".gitignore",
  "env.example",
];

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, "indian-box-office"), { recursive: true });
mkdirSync(join(root, "artifacts"), { recursive: true });

const destRoot = join(staging, "indian-box-office");
for (const rel of files) {
  const from = join(root, rel);
  if (!existsSync(from)) continue;
  cpSync(from, join(destRoot, rel), {
    recursive: true,
    filter: (src) => {
      const base = src.replace(root, "").replace(/\\/g, "/");
      if (base.includes("node_modules")) return false;
      if (base.endsWith(zipName)) return false;
      if (base.includes("/__grok/install/")) return false;
      return true;
    },
  });
}

mkdirSync(join(destRoot, ".grok"), { recursive: true });
cpSync(join(root, ".grok", "app-env.json"), join(destRoot, ".grok", "app-env.json"));
writeFileSync(join(destRoot, ".grok", "README"), "Keep app-env.json. Skills/references are sandbox-only and omitted.\n");

const zipPath = join(staging, zipName);
const py = `
import zipfile, os
root = ${JSON.stringify(destRoot)}
out = ${JSON.stringify(zipPath)}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git")]
        for name in filenames:
            if name == ${JSON.stringify(zipName)}: continue
            full = os.path.join(dirpath, name)
            arc = os.path.join("indian-box-office", os.path.relpath(full, root))
            z.write(full, arc)
print("wrote", out)

`;
const run = spawnSync("python3", ["-c", py], { encoding: "utf8" });
if (run.status !== 0) {
  console.error(run.stdout, run.stderr);
  process.exit(run.status ?? 1);
}

cpSync(zipPath, outArtifact);
cpSync(zipPath, outPublic);
const size = spawnSync("du", ["-h", outArtifact], { encoding: "utf8" });
console.log(size.stdout.trim());
console.log("packed", outArtifact);
console.log("copied", outPublic);
