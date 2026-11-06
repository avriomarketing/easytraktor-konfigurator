# easyTRAKTOR Konfigurator

Mietpreis-Konfigurator für [easytraktor.de](https://easytraktor.de) (Webflow).
Er wird als fertig gebaute Dateien aus `dist/` über jsDelivr direkt aus diesem
Repository geladen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/pricing.js` | Preisberechnung |
| `src/data-provider.dom.js` | Liest Fahrzeuge, Preise und Hersteller aus dem Webflow-CMS (versteckte Listen, siehe unten) |
| `src/template.js` | Markup des Konfigurators |
| `src/configurator.js` | Steuerung (Auswahl, Slider, Ausgabe) |
| `src/konfigurator.css` | Styles, auf `.et-konfigurator` begrenzt |
| `fonts/` | Schrift Manrope, wird eingebettet (kein Abruf bei Google), Lizenz in `fonts/LIZENZ.md` |
| `build.js` | Baut `dist/` aus `src/` und `fonts/` |
| `dist/` | Ausgelieferte Dateien – **nie von Hand bearbeiten**, wird vom Build überschrieben |

## So bindest du den Konfigurator ein

Für die Einbindung brauchst du nur die zwei fertigen Dateien aus `dist/`.
Die übrigen Ordner sind Quellcode und nur nötig, wenn du etwas ändern willst.

### Schritt 1: Dateien bereitstellen

Wähle einen der beiden Wege:

- **A) Über jsDelivr (so läuft es aktuell):** Nichts hochladen. Die Dateien werden
  direkt aus dem GitHub-Repository `avriomarketing/easytraktor-konfigurator`
  geladen. Die Adressen stehen in Schritt 3.
- **B) Auf eigenem Server:** `dist/konfigurator.css` und `dist/easytraktor-konfigurator.js`
  auf einen Webserver laden, der sie öffentlich per HTTPS ausliefert. In Schritt 3
  die jsDelivr-Adressen durch die eigenen ersetzen.

### Schritt 2: Daten im Webflow-CMS anlegen

Der Konfigurator bringt **keine Preise** mit. Er liest Fahrzeuge, Preise, Ausstattung
und Hersteller aus zwei versteckten Collection-Listen auf derselben Seite. Diese
müssen im Webflow-Designer genau so aufgebaut sein, wie unten unter
[„Daten aus dem Webflow-CMS"](#daten-aus-dem-webflow-cms) beschrieben.
Fehlen sie, zeigt der Konfigurator keine Fahrzeuge an.

### Schritt 3: Konfigurator auf der Seite platzieren

Im Webflow-Designer an der gewünschten Stelle ein **„Code Embed"**-Element einfügen
und diese drei Zeilen hineinkopieren:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/avriomarketing/easytraktor-konfigurator@v2.0.4/dist/konfigurator.css">
<div class="et-konfigurator"></div>
<script src="https://cdn.jsdelivr.net/gh/avriomarketing/easytraktor-konfigurator@v2.0.4/dist/easytraktor-konfigurator.js"></script>
```

Das Skript baut den kompletten Konfigurator in das leere `<div class="et-konfigurator">`.
Das Element darf nur **einmal pro Seite** vorkommen.

### Schritt 4: Veröffentlichen und prüfen

1. Die **gesamte Site** publishen (nicht nur die Seite), damit die CMS-Daten im HTML landen.
2. Auf der Live-Seite prüfen: Marke wechseln, Modell wählen, Slider und Checkboxen
   bewegen – der Preis muss sich sofort ändern.
3. Erscheinen keine Fahrzeuge: Prüfen, ob die versteckten Listen aus Schritt 2 auf
   der Seite liegen und mindestens ein Fahrzeug „Aktiv" ist.

**Bei Weg A wichtig:** Das GitHub-Repository muss **öffentlich** bleiben, sonst kann
jsDelivr die Dateien nicht ausliefern.

## Änderungen ausrollen

1. In `src/` ändern.
2. `node build.js` ausführen (erzeugt `dist/`).
3. Committen und einen neuen Tag setzen, z. B. `v2.0.5`.
4. Tag pushen und im Webflow-Embed die Versionsnummer auf den neuen Tag ändern, dann publishen.

Getaggte Stände sind bei jsDelivr unveränderlich. Rollback = im Embed den alten Tag eintragen.

## Daten aus dem Webflow-CMS

Der Code enthält **keine Preise**. Der Konfigurator liest beim Laden zwei versteckte
Collection-Listen (`display:none`), die im Designer auf der Seite liegen. Nur eine
Collection-Liste im Designer bringt CMS-Daten ins HTML – ein HTML-Embed kann das nicht.
CMS-Änderungen werden erst nach einem vollständigen Site-Publish sichtbar.

### Fahrzeuge (`.et-data`)

Collection-Liste „Fahrzeuge", Filter „Aktiv" = an. Item-Div mit Klasse `et-fahrzeug`
und diesen Custom Attributes (Wert „aus Feld"):

| Attribut | CMS-Feld |
|---|---|
| `data-name` | Name |
| `data-slug` | Slug (Datenblatt-Link: `/produkte/<slug>`) |
| `data-hersteller` | Hersteller → Name (`John Deere`, `Case IH`, `JCB`, `Deutz-Fahr`) |
| `data-preise-200` … `data-preise-1250` | Preise je Gesamt-Betriebsstunden (Traktoren): 8 Werte €/h, kommagetrennt, für 2–9 Monate |
| `data-preise-75`, `-100`, `-125` | Preise je Betriebsstunden pro Monat (Teletrak): 3 Werte für 12/24/36 Monate |

Leeres Preisfeld = diese Stufe wird nicht angeboten.

**Teletrak-Variante:** Option-Felder lassen sich in Webflow nicht an Attribute binden.
Deshalb liegt im Item ein leeres Div `et-variante-teletrak`, das per Conditional
Visibility nur bei der Variante „Teletrak" erscheint.

**Ausstattung:** zwei verschachtelte Collection-Listen im Item – Serienausstattung
(Wrapper `et-serie`, vorausgewählt und gesperrt) und optionale Zusatzausstattung
(Wrapper `et-optional`, frei wählbar). Jeder Eintrag:

```html
<div class="et-extra" data-key="{{Slug}}" data-preis="{{Preisaufschlag}}" data-preis-staffel="{{Staffel 12/24/36}}">
  <div class="et-label">{{Name}}</div>
  <div class="et-info">{{Infotext}}</div>
</div>
```

`data-preis-staffel` ist nur bei Teletrak-Ausstattung gefüllt (3 Werte für 12/24/36 Monate).

### Hersteller (`.et-hersteller-data`)

Collection-Liste „Hersteller", **ohne** Filter. Item-Div `et-hersteller` mit
`data-name` = Name. Darin ein leeres Div `et-hersteller-inaktiv`, sichtbar nur wenn
„Aktiv" aus ist. Die Marke wird dann im Konfigurator ausgegraut („Aktuell nicht
verfügbar"). Fehlt die Liste, gelten alle Marken als verfügbar.

## Versionen

| Tag | Stand |
|---|---|
| `v1.0.0` | Erste Version (Traktoren) |
| `v2.0.0` | Teletrak-Variante (JCB) |
| `v2.0.1` – `v2.0.3` | Mobil- und iPhone-Korrekturen (Slider, Labels, Checkboxen) |
| `v2.0.4` | Schriftaustausch |
