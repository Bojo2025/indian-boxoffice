import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const destDir = join(process.cwd(), ".vercel/output/functions/__server.func/_libs");
const srcDir = join(process.cwd(), "node_modules/@electric-sql/pglite/dist");
if (!existsSync(destDir) || !existsSync(srcDir)) process.exit(0);
mkdirSync(destDir, { recursive: true });
for (const file of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
}
