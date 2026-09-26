// build.js — erzeugt die CDN-Auslieferung in dist/.
//  1. bündelt die JS-Module zu dist/easytraktor-konfigurator.js
//     (Reihenfolge wichtig: Pricing + Datenquelle (Model) zuerst, Controller zuletzt)
//  2. kopiert die CSS-Quelle src/konfigurator.css -> dist/konfigurator.css
//  3. baut den Chat-Assistenten zu dist/easytraktor-chat.js: chat/chat-app.html
//     (mit Manrope als Base64 eingebettet) wird als String in chat/chat-launcher.js
//     eingesetzt — eine einzige Datei, keine externen Abrufe.
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

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, banner + parts.join('\n'));
fs.copyFileSync(CSS_SRC, CSS_OUT);

const jsKb = (fs.statSync(OUT).size / 1024).toFixed(1);
const cssKb = (fs.statSync(CSS_OUT).size / 1024).toFixed(1);
console.log(`geschrieben: dist/easytraktor-konfigurator.js (${jsKb} KB)`);
console.log(`kopiert:     dist/konfigurator.css (${cssKb} KB)`);

// ── Chat-Assistent ─────────────────────────────────────────────────────
const CHAT_DIR = path.join(__dirname, 'chat');
const CHAT_OUT = path.join(OUT_DIR, 'easytraktor-chat.js');
const FONT_MARKER = '/*__MANROPE_FONT_FACE__*/';
const APP_MARKER = "/*__CHAT_APP_HTML__*/''";

const fontB64 = fs.readFileSync(path.join(CHAT_DIR, 'fonts', 'manrope-latin-wght.woff2')).toString('base64');
const fontFace = "@font-face{font-family:'Manrope';font-style:normal;font-weight:400 700;font-display:swap;"
  + 'src:url(data:font/woff2;base64,' + fontB64 + ") format('woff2');}";

let appHtml = fs.readFileSync(path.join(CHAT_DIR, 'chat-app.html'), 'utf8');
if (!appHtml.includes(FONT_MARKER)) throw new Error('chat-app.html: Platzhalter ' + FONT_MARKER + ' fehlt');
appHtml = appHtml.replace(FONT_MARKER, fontFace);

let launcher = fs.readFileSync(path.join(CHAT_DIR, 'chat-launcher.js'), 'utf8');
if (!launcher.includes(APP_MARKER)) throw new Error('chat-launcher.js: Platzhalter ' + APP_MARKER + ' fehlt');
// Als JS-String einsetzen; "</" maskieren, falls die Datei je inline in ein <script> kopiert wird.
launcher = launcher.replace(APP_MARKER, () => JSON.stringify(appHtml).replace(/<\//g, '<\\/'));

fs.writeFileSync(CHAT_OUT, launcher);
const chatKb = (fs.statSync(CHAT_OUT).size / 1024).toFixed(1);
console.log(`geschrieben: dist/easytraktor-chat.js (${chatKb} KB)`);
