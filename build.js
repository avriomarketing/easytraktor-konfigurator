// build.js — erzeugt die CDN-Auslieferung in dist/.
//  1. bündelt die JS-Module zu dist/easytraktor-konfigurator.js
//     (Reihenfolge wichtig: Pricing + Datenquelle (Model) zuerst, Controller zuletzt)
//  2. kopiert die CSS-Quelle src/konfigurator.css -> dist/konfigurator.css
// Nach dem Build ist dist/ die vollständige CDN-Payload (beide Dateien hochladen).
// Aufruf: node build.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'easytraktor-konfigurator.js');
const CSS_SRC = path.join(SRC, 'konfigurator.css');
const CSS_OUT = path.join(OUT_DIR, 'konfigurator.css');

const FILES = ['pricing.js', 'data-provider.dom.js', 'template.js', 'configurator.js'];

const banner =
`/*!
 * easyTraktor Konfigurator — gebündelt
 * Enthält (in dieser Reihenfolge): ${FILES.join(', ')}
 * Quelle: /src — NICHT hier editieren, sondern in src/ ändern und neu bauen:
 *   node build.js
 */
`;

const parts = FILES.map((f) => {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  return `\n/* ===== ${f} ===== */\n${code}`;
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, banner + parts.join('\n'));
fs.copyFileSync(CSS_SRC, CSS_OUT);

const jsKb = (fs.statSync(OUT).size / 1024).toFixed(1);
const cssKb = (fs.statSync(CSS_OUT).size / 1024).toFixed(1);
console.log(`geschrieben: dist/easytraktor-konfigurator.js (${jsKb} KB)`);
console.log(`kopiert:     dist/konfigurator.css (${cssKb} KB)`);
