# Spec — Teletrak-Variante (Konfigurator v2)

> ## ▶ UMSETZUNGSSTAND (2026-08-27)
> **Code fertig und lokal verifiziert. CMS angelegt. Designer-Arbeiten offen.**
>
> **Erledigt (Claude):**
> - CMS-Felder angelegt: `konfigurator-variante` (Option), `preise-75-h-teletrak-exklusiv`,
>   `preise-100-h-teletrak-exklusiv`, `preise-125-h-teletrak-exklusiv`,
>   `preisaufschlag-gestaffelt-teletrak-exklusiv`. `preise-200-h` umbenannt
>   (Slug unverändert → keine Bindung betroffen).
> - 4 Anbaugeräte angelegt (`Preisaufschlag` leer, nur Staffel gefüllt).
> - 2 Fahrzeuge angelegt — **beide mit `Aktiv = AUS`**, damit sie nicht in der
>   Live-Datenliste erscheinen können.
> - Code: Provider, zweite Preisformel, Template, Controller. Am E2E-Fixture
>   verifiziert: Preismatrix 9/9 deckungsgleich, Anbaugeräte-Staffel korrekt je
>   Dauer, Rundungs-Fix greift, Variantenwechsel in beide Richtungen, Hidden
>   Fields für beide Varianten, Standard-Fahrzeuge rechnerisch unverändert.
>
> **Noch zu tun (User):**
> 1. Designer: Marker-Div `et-variante-teletrak` + Attribute `data-preise-75/-100/-125`
>    und `data-preis-staffel` (siehe Abschnitt 3).
> 2. Typeform: URL-Parameter `mietdauer` anlegen.
> 3. Die beiden Fahrzeuge auf `Aktiv = an` setzen, **wenn** auf Staging getestet wird.
>    ⚠️ Solange die Live-Domain noch `@v1.0.0` einbindet, dürfen die Fahrzeuge nicht
>    auf der Live-Domain publiziert aktiv sein — der alte Code kennt sie nicht und
>    hätte für sie keine Preisdaten.
> 4. Redaktionsinhalte/Fotos → OFFENE-FRAGEN.md #4

Vollständige Umsetzungs-Spezifikation, abgestimmt 2026-08-17.
Branch: `v2-teletrak` · Live-Rollback-Anker: Tag `v1.0.0` (Commit `a11e5f2`)

**Ziel:** Zwei neue JCB-Teleskoplader erhalten eine eigene Konfigurator-Maske und
eine eigene Preislogik. Die 7 bestehenden Fahrzeuge und die Live-Version bleiben
funktional und rechnerisch **unverändert**.

---

## 1. Die beiden neuen Fahrzeuge

| Feld | Wert |
|---|---|
| Name | `TLT35-26 4x4 Diesel` bzw. `TLT 35-22 2WD Elektro` (Schreibweise s. OFFENE-FRAGEN.md #3) |
| Hersteller | JCB |
| Aktiv | an |
| Konfigurator-Variante | `Teletrak` |
| Preise 75 h | `33.9,31.9,29.9` |
| Preise 100 h | `26.9,24.9,22.9` |
| Preise 125 h | `23.9,21.9,19.9` |
| Optionale Zusatzausstattung | die 4 neuen Anbaugeräte (s. u.) |

Preise beider Fahrzeuge sind **identisch** (bestätigt, kein Copy-Paste-Fehler).
CSV-Reihenfolge = **12 / 24 / 36 Monate**.

---

## 2. CMS-Änderungen

### Collection „Fahrzeuge" (`6a158657dd2577add4c79341`)
**Neu:**
| Feldname | Typ | Hilfetext-Kern |
|---|---|---|
| `Konfigurator-Variante` | Option (`Standard`, `Teletrak`) | Steuert Maske + Preislogik. Leer = Standard. |
| `Preise 75 h (Teletrak exklusiv)` | PlainText | 3 Werte €/Betriebsstunde für 12/24/36 Monate, KOMMA-getrennt, Dezimal mit PUNKT. Nur Teletraks. |
| `Preise 100 h (Teletrak exklusiv)` | PlainText | dito |
| `Preise 125 h (Teletrak exklusiv)` | PlainText | dito |

**Umbenennen (nur Anzeigename, Slug bleibt → keine Bindung bricht):**
`Preise 200 h` → `Preise 200 h (AGRI SUPER exklusiv)`

### Collection „Zusatzausstattung" (`6a328b0cca52631c234c1703`)
**Neues Feld:** `Preisaufschlag gestaffelt (Teletrak exklusiv)` (PlainText)
Hilfetext: *Nur für Teletrak-Anbaugeräte. 3 Werte (€/Betriebsstunde) für 12, 24
und 36 Monate Mietdauer, mit KOMMA getrennt, Dezimal mit PUNKT. Beispiel:
`1.5,0.9,0.6`. Leer = es gilt der Einzelwert aus „Preisaufschlag".*

**Regel: pro Gerät ist genau EINES der beiden Felder gefüllt.**

| | 7 bestehende Geräte | 4 neue Teletrak-Geräte |
|---|---|---|
| `Preisaufschlag` | gefüllt, unverändert | **leer** |
| `Preisaufschlag gestaffelt` | **leer** | alle 3 Werte |

**4 neue Items** (frei wählbar / optional, kein Default angewählt):
```
1. Schaufel           →  1.5,0.9,0.6
2. Schaufel           →  1.9,1.2,0.8
Zinkenverstellgerät   →  3.0,1.6,1.1
Drehgerät             →  8.3,4.2,2.9
```
Anzeigenamen der Schaufeln noch offen → OFFENE-FRAGEN.md #1

---

## 3. Designer-Arbeiten (nur manuell möglich)

1. **Variante-Marker** (Webflow kann Option-Felder nicht ans Attribut binden —
   gleiche Einschränkung wie beim Switch „Aktiv"):
   Im `.et-fahrzeug`-Item ein leeres Div mit Klasse **`et-variante-teletrak`**,
   per **Conditional Visibility** nur sichtbar wenn `Konfigurator-Variante = Teletrak`.
   ⚠️ Richtung prüfen — Marker darf nur bei Teletraks erscheinen.
2. **Neue Preis-Attribute** am `.et-fahrzeug`-Item:
   `data-preise-75`, `data-preise-100`, `data-preise-125`
3. **Staffel-Attribut** an den `.et-extra`-Items der verschachtelten
   Zusatzausstattungs-Listen: `data-preis-staffel`

---

## 4. Interface-Verhalten

Ein einziges Template, Feldgruppen werden pro Variante ein-/ausgeblendet
(kein Template-Tausch → keine Listener-Neuverdrahtung, kein Zustandsverlust).

| Element | Standard | Teletrak |
|---|---|---|
| Mietstart | Feb–Nov, saisonales Fenster | **rollierend die nächsten 12 Monate**, ab Folgemonat, jeder Eintrag mit eigenem Jahr |
| 2. Datumsfeld | „Mietende" (Monat) | **„Mietdauer"** — 12 / 24 / 36 Monate |
| Label 2. Feld | `Mietende` | `Mietdauer (Ende: 01.03.2028)` — 1. des Startmonats + N Monate |
| Stunden-Label | `Mietbetriebsstunden:` | `Mietbetriebsstunden pro Monat:` |
| Stunden-Stufen | 200–1250 (aus Daten) | 75 / 100 / 125 (aus Daten) |
| Selbstbehalt | 1.000/2.500 €, +0,20 €/h | **unverändert gleich** |
| Ausstattungs-Label | „Zusatzausstattung" | **bleibt „Zusatzausstattung"** |
| Preisausgabe | €/Betriebsstunde + €/Monat | **unverändert gleich** |

---

## 5. Preislogik

**Standard (unverändert, cent-genau PHP-treu):** nicht anfassen.
`sumMonth = nf2(sumHour × Gesamtstunden ÷ Mietdauer)`

**Teletrak (neuer, separater Rechenpfad):**
```
sumHour  = nf2( Basis + Anbaugeräte-Aufschläge + Selbstbehalt-Aufschlag )
sumMonth = nf2( sumHour × Stunden pro Monat )      // KEINE Division durch Mietdauer
```
- Basis: `Preise <Stunden> h`-CSV, Index nach Mietdauer (12→0, 24→1, 36→2)
- Anbaugeräte: Wert aus `Preisaufschlag gestaffelt` nach Mietdauer;
  fehlt die Staffel → Einzelwert aus `Preisaufschlag`
- **Saubere Rundung, KEIN PHP-`ceil`-Quirk.** Begründung: Der Quirk existiert nur
  zur cent-genauen Kompatibilität mit dem TYPO3-Altsystem, in dem die Teletraks
  nie kalkuliert wurden. Geprüft: in 3 von 108 Kombinationen würde er einen
  sichtbar falschen Preis erzeugen (z. B. 125 h / 36 Mon / SB 1.000 € →
  20,11 statt 20,10 €/h = 1,25 €/Monat zu viel).

**Kontrollwerte (ohne Extras, SB 2.500 €):**
| h/Monat | 12 Mon | 24 Mon | 36 Mon |
|---|---|---|---|
| 75 | 33,90 → 2.542,50 €/M | 31,90 → 2.392,50 €/M | 29,90 → 2.242,50 €/M |
| 100 | 26,90 → 2.690,00 €/M | 24,90 → 2.490,00 €/M | 22,90 → 2.290,00 €/M |
| 125 | 23,90 → 2.987,50 €/M | 21,90 → 2.737,50 €/M | 19,90 → 2.487,50 €/M |

---

## 6. Typeform

- **Neues URL-Parameter-Feld `mietdauer`** (in Typeform unter
  Workflow → „Pull data in" anlegen). Bleibt bei Standardfahrzeugen leer —
  leere Werte werden ohnehin aus der URL gefiltert.
- `miete_ende` erhält bei Teletraks das **errechnete Enddatum** (z. B. `01.03.2028`).
- `miete_betriebsstunden` wird bei Teletraks als **„100 pro Monat"** ausgegeben,
  damit im Angebot erkennbar ist, dass es Monatsstunden sind.

---

## 7. Deployment

- Entwicklung auf `v2-teletrak`, **`master` bleibt unangetastet** auf dem Live-Stand.
- Test über jsDelivr mit **Commit-Hash** (`@<hash>`) statt Branch-Name — Branch-URLs
  cached jsDelivr mit Verzögerung, Hashes sind sofort korrekt. Für die Abnahmephase
  auf Beta-Tags (`v2.0.0-beta.1` …) wechseln.
- Webflow: neuen Custom-Code **nur auf die Staging-Domain** (`*.webflow.io`)
  publizieren, Produktiv-Domain beim Publizieren abwählen.
- Go-Live: Custom-Code-URL der Live-Domain auf den finalen Tag umstellen.
  `v1.0.0` bleibt dauerhaft als Rollback-Anker bestehen.

---

## 8. Sonstige Feststellungen

- **Modell-Reihenfolge:** Die Collection-Liste sortiert nach Erstellungsdatum
  (neueste zuerst), **nicht** alphabetisch. Die neuen Teletraks landen damit
  innerhalb von JCB **vor** dem AGRI SUPER — ein Klick auf JCB wählt also einen
  Teletrak vor und schaltet direkt die neue Maske. So gewollt (2026-08-17).
  Änderbar über die Sortierung der Collection-Liste im Designer, ohne Code.
- **17 Fahrzeuge im CMS, 7 auf „Aktiv"** (6 Case IH, 3 Deutz-Fahr, 1 JCB Fastrac
  sind deaktiviert). Kein Limit auf der Collection-Liste — die neuen Fahrzeuge
  werden normal ausgegeben, sobald sie aktiv sind.
