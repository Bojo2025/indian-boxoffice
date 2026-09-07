#!/usr/bin/env node
/**
 * Desk-style SVG stand-ins for titles without licensed poster art.
 * Existing JPGs in public/posters are left untouched.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "posters");
mkdirSync(outDir, { recursive: true });

const posters = [
  ["hi", "Hi", "Tamil"],
  ["insidious-further", "Insidious: Out of The Further", "English"],
  ["paw-patrol-dino", "PAW Patrol: The Dino Movie", "English"],
  ["hanuman-ansh", "Hanuman Ansh", "Hindi"],
  ["spider-man-bnd", "Spider-Man: Brand New Day", "English"],
  ["dhamaal-4", "Dhamaal 4", "Hindi"],
  ["the-odyssey", "The Odyssey", "English"],
  ["peddi", "Peddi", "Telugu"],
  ["jana-nayagan", "Jana Nayagan", "Tamil"],
  ["karuppu", "Karuppu", "Tamil"],
  ["msvpg", "Mana Shankara Vara Prasad Garu", "Telugu"],
  ["bhooth-bangla", "Bhooth Bangla", "Hindi"],
  ["drishyam-3", "Drishyam 3", "Malayalam"],
  ["vaazha-ii", "Vaazha II", "Malayalam"],
  ["welcome-jungle", "Welcome To The Jungle", "Hindi"],
  ["cocktail-2", "Cocktail 2", "Hindi"],
  ["alpha", "Alpha", "Hindi"],
];

function wrapTitle(title, max = 16) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function svgFor(title, language) {
  const lines = wrapTitle(title);
  const startY = 320 - (lines.length - 1) * 22;
  const text = lines
    .map(
      (line, i) =>
        `<text x="28" y="${startY + i * 44}" fill="#f3efe6" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="500">${escapeXml(line)}</text>`,
    )
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" role="img" aria-label="${escapeXml(title)}">
  <rect width="400" height="600" fill="#1b1814"/>
  <rect x="0" y="0" width="8" height="600" fill="#c45c3e"/>
  <text x="28" y="48" fill="#c45c3e" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" letter-spacing="3">${escapeXml(language.toUpperCase())}</text>
  ${text}
  <text x="28" y="560" fill="#9a9488" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" letter-spacing="2">IBO DESK FILE</text>
</svg>
`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let wrote = 0;
for (const [key, title, language] of posters) {
  const jpg = join(outDir, `${key}.jpg`);
  if (existsSync(jpg)) continue;
  writeFileSync(join(outDir, `${key}.svg`), svgFor(title, language));
  wrote += 1;
}
console.log(`wrote ${wrote} svg posters → ${outDir}`);
