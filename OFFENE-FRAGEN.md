# Offene Fragen — Klärung mit Kunde / intern

Laufende Liste von Punkten, die noch eine Entscheidung oder Rückmeldung brauchen.
Umsetzung läuft solange mit der jeweils genannten **Zwischenlösung** weiter.

---

## 1. Anzeigenamen der Schaufeln (Teletrak-Anbaugeräte)
*(erfasst 2026-08-17)*

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

## 2. Selbstbehalt bei den Teletraks — dauerhaft so?
*(erfasst 2026-08-17)*

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

## 3. Schreibweise der Modellnamen
*(erfasst 2026-08-17 — von Claude ergänzt, weil noch ungeklärt)*

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
