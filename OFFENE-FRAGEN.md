# Offene Fragen — Klärung mit Kunde / intern

Laufende Liste von Punkten, die noch eine Entscheidung oder Rückmeldung brauchen.
Umsetzung läuft solange mit der jeweils genannten **Zwischenlösung** weiter.

---

## ⚠️ 0. BEKANNTES LIVE-PROBLEM — bewusst zurückgestellt (2026-08-27)

**Zustand:** Auf `easytraktor.de` sind die beiden Teletraks aktiv und im
gerenderten HTML, die Seite lädt aber weiterhin `@v1.0.0`. Der alte Code kennt
die Variante nicht und findet für sie keine Preisdaten → beim Klick auf JCB wird
ein Teletrak vorausgewählt und der **Preis des zuvor gewählten Fahrzeugs
stehengelassen** (nachgebaut mit dem echten v1.0.0-Bundle: 17,40 €/h ·
5.800,00 €/Monat, also John-Deere-Preise für einen Teleskoplader).

**Ursache:** `Aktiv` ist ein globaler CMS-Schalter — Live und Staging brauchen
hier aber unterschiedliche Zustände.

**Vom User bewusst zurückgestellt** (2026-08-27) — nicht vergessen, wird mit dem
Go-Live ohnehin aufgelöst.

**Zwei fertige Lösungswege, wenn es angegangen wird:**
1. *Sofort, kein Code:* beide Teletraks auf `Aktiv = aus`, dann **nur** auf die
   Live-Domain publizieren. Staging behält seinen Build mit den Fahrzeugen.
2. *Strukturell:* `v1.0.1` auf `master` — Fahrzeuge ohne jegliche Preisdaten
   werden nicht im Dropdown angeboten. Danach ignoriert der Live-Code die
   Teletraks unabhängig vom Aktiv-Schalter; Live und Staging sind entkoppelt.

---

## 1. Anzeigenamen der Schaufeln (Teletrak-Anbaugeräte)
*(erfasst 2026-08-17 · TEILWEISE GEKLÄRT 2026-08-31)*

> **Kunde liefert:** „Gr. Schaufel" = Universalschaufel mit 1 cbm Inhalt · „Kl. Schaufel" =
> Universalschaufel mit 0,6 cbm Inhalt.
> **NOCH OFFEN:** Welcher Preis gehört zu welcher Schaufel? Die Spaltenreihenfolge der
> Preistabelle (1. Schaufel = 0,90 / 2. Schaufel = 1,20) und die Reihenfolge der neuen
> Namensliste (Gr. vor Kl.) widersprechen der Preislogik (größere Schaufel müsste mehr
> kosten). Muss beim Kunden bestätigt werden, bevor umbenannt wird.

**Frage:** Wie sollen die beiden Schaufeln im Konfigurator heißen?

In der Preistabelle stehen sie als **„1. Schaufel"** und **„2. Schaufel"**. Als
Checkbox-Beschriftung im Konfigurator ist das für Kunden nicht aussagekräftig —
es ist nicht erkennbar, worin sie sich unterscheiden (Größe? Volumen? Typ?).

Die bestehenden Anbaugeräte sind sprechend benannt (z. B. „Palettengabel",
„Greifschaufel", „Univ. Schaufel", jeweils mit Infotext wie „2,4 m³").

**Gebraucht wird:** je Schaufel ein sprechender Name + optional ein Infotext
(erscheint im ⓘ-Tooltip, z. B. Volumen/Breite).

**Zwischenlösung:** Anlage als „1. Schaufel" / „2. Schaufel" gemäß Tabelle,
Umbenennung später jederzeit im CMS möglich (rein redaktionell, kein Code).

**Preise (unverändert, 2-Jahre-Wert):** 1. Schaufel 0,90 €/h · 2. Schaufel 1,20 €/h

---

## 2. Selbstbehalt bei den Teletraks — dauerhaft so?  ✅ GEKLÄRT
*(erfasst 2026-08-17 · geklärt 2026-08-31)*

> **Antwort Kunde:** „Der Selbstbehalt bleibt bei 1.000 / 2.500 €." Keine Änderung nötig,
> Umsetzung bleibt wie sie ist.

**Frage:** Bleibt die Selbstbehalt-Auswahl (1.000 € / 2.500 €, Aufschlag
+0,20 €/h bei 1.000 €) bei den Teletraks langfristig unverändert?

**Hintergrund:** Die Preistabelle für die Teletraks enthält keine Angabe zum
Selbstbehalt. Die Regel wurde ursprünglich für die Traktoren-Maschinenbruch-
versicherung definiert — ob sie für Teleskoplader (anderer Maschinentyp, andere
Einsatzumgebung, Mietdauern von 1–3 Jahren) fachlich genauso gilt, ist offen.

**Zwischenlösung / aktueller Stand:** Auswahl bleibt unverändert wie bei den
Traktoren (bestätigt 2026-08-17), ist so umgesetzt.

**Auswirkung einer Änderung:** Betrifft nur die Preisformel + ggf. Ausblenden des
Sliders für die Teletrak-Variante — überschaubarer Aufwand.

---

## 3. Schreibweise der Modellnamen  ✅ GEKLÄRT
*(erfasst 2026-08-17 · geklärt 2026-08-31)*

> **Offizielle Bezeichnungen laut Kunde:** `JCB Teletruk TLT 35-26D 4x4` und
> `JCB Teletruk TLT 35-22E 2WD`. Im CMS als Name eingetragen (2026-08-31);
> Slugs bewusst unverändert gelassen, damit keine Links brechen.

**Frage:** Wie lauten die exakten, kundenseitig gewünschten Modellnamen?

In der Preistabelle sind die beiden Fahrzeuge **inkonsistent geschrieben**:

| Tabelle | Auffälligkeit |
|---|---|
| `TLT35-26 4x4 Diesel` | **kein** Leerzeichen nach „TLT" |
| `TLT 35-22 2WD Elektro` | **mit** Leerzeichen nach „TLT" |

**Warum das relevant ist:** Der Name im CMS-Feld „Name" landet 1:1
- als Text im Modell-Dropdown des Konfigurators,
- im Angebots-Formular (Typeform-Feld `miete_modell`) und damit in der
  Angebots-E-Mail an den Vertrieb,
- als Grundlage für den Slug der Detailseite (`/produkte/<slug>`).

**Zwischenlösung:** Anlage exakt wie in der Tabelle. Korrektur später rein
redaktionell möglich — **Achtung:** eine Änderung des *Slugs* würde bestehende
Links auf die Detailseite brechen, der *Name* allein ist unkritisch.

---

## 4. Texte und Bildmaterial zu den beiden neuen Geräten liefern
*(erfasst 2026-08-17)*

**Frage:** Wer liefert Redaktionsinhalte und Fotos für `TLT35-26 4x4 Diesel` und
`TLT 35-22 2WD Elektro`?

**Hintergrund:** Die beiden Teletraks liegen in der Fahrzeuge-Collection und
werden deshalb — wie alle anderen Fahrzeuge — **automatisch** in den Fahrzeug-
Slidern der Website ausgegeben und erhalten eine Detailseite unter
`/produkte/<slug>` (auf die auch der Datenblatt-Button im Konfigurator zeigt).

**Gebraucht wird pro Fahrzeug:**

| CMS-Feld | Anforderung |
|---|---|
| `Foto` | quadratisch, weißer Hintergrund, idealerweise `.webp` (`.jpg` ok, `.png` vermeiden) |
| `Kurzbeschreibung` | max. 80 Zeichen (Teaser auf der Slider-Karte) |
| `Beschreibung` | RichText |
| `Technische Daten` | RichText |

> **Status 2026-08-31:** Beschreibung, Technische Daten (Musterkonfiguration) und
> Kurzbeschreibung sind eingepflegt. **Fotos fehlen weiterhin** — Kunde schreibt
> „aktuell leider nicht höherauflösend verfügbar", Bilder lagen der Mail bei.

**Zwischenlösung:** Die Fahrzeuge können ohne diese Inhalte angelegt werden —
der **Konfigurator funktioniert vollständig**, aber Slider-Karte und Detailseite
bleiben inhaltlich unvollständig (Platzhalter/leere Bereiche).
