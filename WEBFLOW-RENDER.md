# Webflow Render-Contract — versteckte Daten-Insel für den Konfigurator (Stufe 2)

Der Konfigurator liest seine Daten **aus dem DOM** der gepublishten Seite. Dazu
rendert Webflow die Collections als **versteckte Collection-Liste** mit festen
`data-*`-Attributen / CSS-Klassen. `src/data-provider.dom.js` liest genau diese
Struktur. Diese Datei ist der verbindliche Vertrag zwischen Designer-Aufbau und JS.

> Wichtig: Nur ein **Collection-List-Element im Designer** holt CMS-Daten ins
> statische HTML. Ein HTML-Embed kann das NICHT. Die Insel unten wird also als
> Designer-Element gebaut, nicht im Embed.

## Platzierung
Irgendwo auf der Konfigurator-Seite (z. B. direkt vor/nach dem Konfigurator-Embed)
ein Wrapper-DIV mit Klasse **`et-data`** und **`display:none`** (oder Attribut `hidden`).
Inhalt = eine Collection-Liste „Fahrzeuge".

## Struktur (genau so)

```html
<div class="et-data" style="display:none">

  <!-- Collection List: Fahrzeuge, FILTER: "Aktiv" ist an -->
  <div class="et-fahrzeug"
       data-name="{{ Name }}"
       data-slug="{{ Slug }}"
       data-hersteller="{{ Hersteller → Name }}"
       data-preise-200="{{ Preise 200 h }}"
       data-preise-300="{{ Preise 300 h }}"
       data-preise-500="{{ Preise 500 h }}"
       data-preise-750="{{ Preise 750 h }}"
       data-preise-1000="{{ Preise 1000 h }}"
       data-preise-1250="{{ Preise 1250 h }}">

    <!-- Marke kommt aus data-hersteller (oben). Hersteller ist Pflichtfeld → immer gesetzt. -->

    <!-- Serienausstattung (verschachtelte Collection-Liste auf das Multi-Ref-Feld) -->
    <div class="et-serie">
      <div class="et-extra" data-key="{{ Slug }}" data-preis="{{ Preisaufschlag }}">
        <div class="et-label">{{ Name }}</div>
        <div class="et-info">{{ Infotext (Rich Text) }}</div>
      </div>
    </div>

    <!-- Optionale, konfigurierbare Zusatzausstattung (verschachtelte Collection-Liste) -->
    <div class="et-optional">
      <div class="et-extra" data-key="{{ Slug }}" data-preis="{{ Preisaufschlag }}">
        <div class="et-label">{{ Name }}</div>
        <div class="et-info">{{ Infotext (Rich Text) }}</div>
      </div>
    </div>

  </div>
</div>
```

`{{ … }}` = im Designer ein CMS-Feld an dieses Attribut / diesen Text binden.

## So wird's im Webflow-Designer gebaut

1. **Wrapper** `et-data` (Div), Sichtbarkeit `display:none`.
2. Darin eine **Collection List** → Quelle **Fahrzeuge**, **Filter: „Aktiv" = An**.
   - Das Collection-**Item**-Div bekommt Klasse `et-fahrzeug` und diese
     **Custom Attributes** (Settings → Add Custom Attribute → Wert = „Get from field"):
     `data-name`=Name, `data-slug`=Slug, **`data-hersteller`=Hersteller → Name**,
     `data-preise-200`=Preise 200 h, …, `data-preise-1250`=Preise 1250 h.
3. **Marke:** `data-hersteller` = Hersteller → Name (Schritt 2). Kein Unter-Div nötig.
4. Im Item eine **verschachtelte Collection List** auf das Multi-Ref-Feld
   **Serienausstattung**; Wrapper-Klasse `et-serie`. Deren Item-Div = `et-extra` mit
   Custom Attrs `data-key`=Slug, `data-preis`=Preisaufschlag; darin `et-label`
   (Text=Name) und `et-info` (Rich-Text-Element = Infotext).
5. Dasselbe nochmal für **Optionale, konfigurierbare Zusatzausstattung**, Wrapper `et-optional`.

## Wie der Provider das interpretiert
- Nur Fahrzeuge im DOM (= Filter „Aktiv" greift schon in Webflow) werden angeboten.
- `data-hersteller` (Attribut am Item) → Markenfilter; muss „John Deere/Case IH/JCB/Deutz-Fahr" sein.
- `data-link` wird aus `data-slug` gebaut: **`/produkte/<slug>`** (Datenblatt-Button).
- `data-preise-<stunden>` (8 kommagetrennte €/h, Mietdauer 2–9 Mon.) → `month-price`
  `[0,0, …8 Werte]`. Leeres Feld = Stufe wird nicht angeboten.
- `et-serie .et-extra` = vorausgewählt + gesperrt (Aufschlag immer im Preis);
  `et-optional .et-extra` = frei wählbar. `data-preis` = €/h-Aufschlag, `et-info` = Tooltip.

## Slug-Basis-Pfad
Die Fahrzeuge-Collection hat den Slug **`produkte`**, Detailseiten liegen also unter
`/produkte/<item-slug>`. Falls das je geändert wird, in `data-provider.dom.js` die
Konstante `DETAIL_BASE` anpassen.

## Hersteller-Status (Marke sperren) — zweite versteckte Liste

Damit eine ganze Marke im Konfigurator **ausgegraut + nicht klickbar** wird (Hover-
Tooltip „Aktuell nicht verfügbar"), liest der Provider eine **zweite** versteckte
Collection-Liste aus der **Hersteller**-Collection. Steuerung über das vorhandene
Switch-Feld **„Aktiv"** auf dem Hersteller.

```html
<div class="et-hersteller-data" style="display:none">
  <!-- Collection List: Hersteller (KEIN Filter — alle anzeigen!) -->
  <div class="et-hersteller"
       data-name="{{ Name }}"
       data-aktiv="{{ Aktiv }}"></div>
</div>
```

### So wird's im Designer gebaut
1. **Wrapper** `et-hersteller-data` (Div), `display:none`.
2. Darin eine **Collection List** → Quelle **Hersteller**, **OHNE Filter** (alle Marken,
   auch inaktive — sonst können wir die inaktiven nicht ausgrauen).
3. Item-Div = Klasse `et-hersteller` mit Custom Attributes:
   - `data-name` = Name (muss exakt „John Deere/Case IH/JCB/Deutz-Fahr" sein — wird mit
     dem `data-brand` der Buttons abgeglichen).
   - `data-aktiv` = Feld **Aktiv** (Switch). Webflow gibt „true"/„false" aus.

### Wie der Provider das interpretiert
- `aktiv = false` (bzw. `0/no/off/nein/aus`) → Marke gesperrt: Button ausgegraut,
  nicht klickbar, Hover-Tooltip „Aktuell nicht verfügbar".
- Fehlt die Liste komplett (oder ein Hersteller fehlt darin) → gilt als **verfügbar**
  (kein Sperren). Rückwärtskompatibel: ohne diese Liste verhält sich alles wie bisher.
- **Fallback**, falls die `data-aktiv`-Bindung in Webflow zickt: statt des Attributs ein
  Kind-Element `<div class="et-inaktiv">` ins Item legen und per **Conditional Visibility
  „Aktiv ist aus"** einblenden — der Provider wertet auch das als gesperrt.
- Sind eine/mehrere Marken gesperrt, wählt der Konfigurator beim Start automatisch die
  **erste verfügbare** Marke aus.

> Wie bei den Fahrzeugen: CMS-Änderungen am „Aktiv"-Switch werden erst nach einem
> **vollständigen Site-Publish** im gerenderten HTML sichtbar.
