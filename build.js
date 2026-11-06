// build.js — erzeugt die CDN-Auslieferung in dist/.
//  1. bündelt die JS-Module zu dist/easytraktor-konfigurator.js
//     (Reihenfolge wichtig: Pricing + Datenquelle (Model) zuerst, Controller zuletzt)
//  2. schreibt src/konfigurator.css -> dist/konfigurator.css und bettet dabei die
//     Schrift Manrope (fonts/) als Base64 ein — kein Abruf bei Google Fonts
// Nach dem Build ist dist/ die vollständige CDN-Payload.
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

// Schrift Manrope (OFL, lateinischer Zeichensatz, Gewichte 400–700) — wird in
// die Konfigurator-CSS eingebettet, damit zur Laufzeit nichts von extern kommt.
const FONT_MARKER = '/*__MANROPE_FONT_FACE__*/';
const fontB64 = fs.readFileSync(path.join(__dirname, 'fonts', 'manrope-latin-wght.woff2')).toString('base64');
const fontFaceFor = (family) => "@font-face{font-family:'" + family + "';font-style:normal;font-weight:400 700;font-display:swap;"
  + 'src:url(data:font/woff2;base64,' + fontB64 + ") format('woff2');}";

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, banner + parts.join('\n'));

const cssSrc = fs.readFileSync(CSS_SRC, 'utf8');
if (!cssSrc.includes(FONT_MARKER)) throw new Error('konfigurator.css: Platzhalter ' + FONT_MARKER + ' fehlt');
// Eigener Familienname, damit die Manrope der Website (Webflow-gehostet)
// nicht seitenweit überschrieben wird.
fs.writeFileSync(CSS_OUT, cssSrc.replace(FONT_MARKER, fontFaceFor('Manrope ET')));

const jsKb = (fs.statSync(OUT).size / 1024).toFixed(1);
const cssKb = (fs.statSync(CSS_OUT).size / 1024).toFixed(1);
console.log(`geschrieben: dist/easytraktor-konfigurator.js (${jsKb} KB)`);
console.log(`geschrieben: dist/konfigurator.css (${cssKb} KB)`);

