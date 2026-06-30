# Offene Anforderungen — easyTraktor Konfigurator

Laufende Liste noch umzusetzender Features. Wird abgearbeitet, wenn Stufe 2
(verstecktes CMS-Rendering + echter Daten-Provider + View-Ergänzungen) gebaut wird.

---

## 1. Datenblatt-Button neben dem Modell-Dropdown  (erfasst 2026-06-17)

**STATUS: Frontend gebaut (2026-06-17).** Button + Icon + Tooltip „Zum Datenblatt
des ausgewählten Fahrzeugs" sind in `template.js`/`konfigurator.css`/`configurator.js`
umgesetzt; Controller setzt `href` auf `tractor.link`. **OFFEN:** (a) Link-Quelle
entscheiden (CMS-Detailseite `/produkte/<slug>` vs. separates Datenblatt-Feld),
(b) Provider (Stufe 2) muss `link` pro Fahrzeug liefern — bis dahin ist der Button
sichtbar, aber ohne Ziel (kein `href`, nicht navigierbar).


**Was:** Rechts neben dem Modell-Auswahl-Dropdown ein **kleiner, oranger,
kreisförmiger Button** mit einem **weißen Datenblatt-Icon** (SVG siehe unten).

**Verhalten:** Klick → öffnet **den jeweiligen Traktor in einem neuen Tab**
(`target="_blank"`, `rel="noopener"`).

**Datenquelle / Abhängigkeit:** Beim Ausgeben der Collection muss **pro Fahrzeug
der Link mitkommen**. Der Controller setzt den `href` des Buttons beim
Modellwechsel auf den Link des aktuell gewählten Traktors.

**⚠️ Vor der Umsetzung zu klären:** Welcher Link ist gemeint?
- (a) die **CMS-Detailseite** des Fahrzeugs (`/produkte/<slug>`) — kein neues
  Feld nötig, der Provider kann die URL aus dem Slug/Item-Link bilden, **oder**
- (b) ein **separates Datenblatt** (z. B. PDF / externer Link) — dann brauchen
  wir ein zusätzliches Link-Feld in der Collection „Fahrzeuge".

*(Im alten TYPO3-Konfigurator gab es bereits einen `.open-datasheet`-Button, der
per `data-src` die Traktor-ID/Quelle trug — Konzept also bekannt.)*

**Umsetzungsskizze (Stufe 2):**
- `template.js`: Modell-Zeile in einen Flex-Container; rechts neben dem Dropdown
  ein `<a class="calc__datasheet" data-datasheet target="_blank" rel="noopener">`
  mit dem Icon-SVG.
- `configurator.js`: bei `selectModel()` den `href` aus `tractor.link` setzen;
  Button ausblenden/deaktivieren, wenn kein Link vorhanden.
- `konfigurator.css`: kreisförmiger Button (~38–40px), Hintergrund `#ee7500`,
  Icon weiß, zentriert; an die Höhe des Dropdown-Triggers angepasst.
- Provider (Stufe 2): liefert `link` pro Fahrzeug aus der Collection.

**Icon (SVG, weiß):**
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><title>page</title><g fill="#ffffff"> <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C8.68629 2 6 4.68629 6 8V40C6 43.3137 8.68629 46 12 46H36C39.3137 46 42 43.3137 42 40V8C42 4.68629 39.3137 2 36 2H12ZM12 8H36V22H12V8ZM36 25H12V28H36V25ZM12 31H36V34H12V31ZM26 37H12V40H26V37Z" fill="#ffffff"></path> </g></svg>
```
