# easyTraktor Konfigurator — Einbindung in Webflow (Stufe 1)

Stufe 1 bringt den Konfigurator in Webflow zum Laufen — noch mit **Mock-Daten**
(im JS-Bundle eingebettet). Stufe 2 ersetzt die Datenquelle durch die Webflow-Collection.

**Full-Injection-Ansatz:** Das komplette Markup steckt im JS-Bundle (`template.js`)
und wird vom Script in ein leeres `<div class="et-konfigurator">` injiziert. Das
Webflow-Embed besteht damit nur aus **3 Zeilen** und wird **nie wieder angefasst** —
sämtliche Wartung (Logik, Daten, Markup, Styles) läuft über die CDN-Dateien.

## Dateien

Nach `node build.js` liegt in **`dist/` die komplette CDN-Payload** — beide Dateien dort hochladen:

| Datei | Wohin | Zweck |
|---|---|---|
| `dist/easytraktor-konfigurator.js` | euer CDN | Logik **+ Markup** (Pricing + Datenquelle + Template + Controller), gebündelt |
| `dist/konfigurator.css` | euer CDN | Styles (auf `.et-konfigurator` gescopt) |

## Schritte

1. **Auf euer CDN laden:** beide Dateien aus `dist/` (`easytraktor-konfigurator.js`
   und `konfigurator.css`). Notiert euch die zwei öffentlichen URLs.

2. **In Webflow** an die gewünschte Stelle der Seite ein **„HTML Embed"**-Element
   ziehen und diese **3 Zeilen** hineinkopieren — die beiden `DEIN-CDN`-URLs auf
   eure Pfade aus Schritt 1 anpassen:
   ```html
   <link rel="stylesheet" href="https://cdn.avrio-hosting.de/easyTRAKTOR/konfigurator/konfigurator.css">
   <div class="et-konfigurator"></div>
   <script src="https://cdn.avrio-hosting.de/easyTRAKTOR/konfigurator/easytraktor-konfigurator.js"></script>
   ```

3. **Veröffentlichen** und testen: Marke wechseln, Modell wählen, Slider/Checkboxen —
   der Preis muss live aktualisieren.

### Alternative Aufteilung (falls bevorzugt)
Statt allem in einem Embed:
- `<link …konfigurator.css>` → Page Settings → **Inside `<head>` tag**
- `<script …easytraktor-konfigurator.js>` → Page Settings → **Before `</body>` tag**
- Nur das leere `<div class="et-konfigurator"></div>` ins Embed-Element.

> Mehrere Konfiguratoren auf einer Seite: einfach mehrere leere
> `<div class="et-konfigurator"></div>` platzieren — das Script befüllt alle.

## ⚠️ Wichtig: Hersteller-Logos neu hosten

Die vier Logos stecken jetzt in **`src/template.js`** und zeigen aktuell auf
**temporäre Figma-Asset-URLs** (`https://www.figma.com/api/mcp/asset/…`). Diese
**laufen ab** und sind nicht für Produktion geeignet. Vor dem Livegang:
1. Logos als Bilder exportieren/beschaffen.
2. In Webflow (Assets) oder aufs CDN laden.
3. Die vier `<img src="…">` in `src/template.js` auf die neuen URLs umstellen,
   dann `node build.js` und das neue Bundle aufs CDN.
   (Die `data-brand`-Werte NICHT ändern — daran hängt die Filterlogik.)

## Schriftart
`konfigurator.css` lädt **Manrope** selbst per `@import` (Google Fonts). Optional
könnt ihr Manrope zusätzlich in den Webflow-Projekteinstellungen hinterlegen.

## Wartung (nach Stufe 1)
Immer in `src/` editieren, dann `node build.js`, dann **die geänderte(n) Datei(en)
aus `dist/` aufs CDN** laden. `dist/` nie von Hand editieren (wird überschrieben).
- Logik/Daten ändern → `src/pricing.js` bzw. `src/data-provider.js`.
- Markup/Texte/Logos ändern → `src/template.js`.
- Styles ändern → `src/konfigurator.css`.
- Das Webflow-Embed (die 3 Zeilen) bleibt für immer unangetastet.

## Nächster Schritt: Stufe 2 (CMS)
Webflow-Collection anlegen, deren Felder die `traktoren.json`-Struktur spiegeln,
als `display:none`-Liste in die Seite rendern, und `src/data-provider.js` durch
eine Variante ersetzen, die diese Liste ausliest (gleiche `getAll()/getById()`-
Schnittstelle). Nur diese eine Datei wird getauscht, dann neu bauen.
