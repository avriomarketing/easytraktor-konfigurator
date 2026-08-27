/**
 * pricing.js — Preisberechnung des Traktor-Konfigurators
 * =====================================================================
 *
 * Ersetzt die alte serverseitige Berechnung (TYPO3/PHP, POST /tractor-calculation).
 * Reine Logik: KEINE Abhängigkeit zu DOM, jQuery oder Datenquelle.
 *
 * ✅ ABGEGLICHEN mit dem Original `CalculationService.php`
 *    (EcomWebservices\TractorCalculation\Service, erhalten 2026-06-14).
 *    Die früheren „offenen Annahmen" sind damit geklärt — siehe FORMEL.
 *
 * ─────────────────────────────────────────────────────────────────────
 * DATENMODELL (wie traktoren.json)
 * ─────────────────────────────────────────────────────────────────────
 *   {
 *     "mietbetriebsstunden": {
 *       "1000": {
 *         "price": -1,                              // <0  -> month-price benutzen
 *         "month-price": [0,0,17.4,17.4,17.4,...],  // Index = (exklusive) Monatsdifferenz
 *         "fzw":1.0,"rtk":1.5,"les":0.5,"zwa":0.2   // Aufschlag €/Stunde je Zusatzleistung
 *       }, ...
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────
 * FORMEL (exakt wie CalculationService::calculate)
 * ─────────────────────────────────────────────────────────────────────
 *   mietdauer        = mietende − mietstart + 1     // INKLUSIVE Monatszahl
 *   preisIndex       = mietdauer − 1                // = exklusive Differenz (Monatsindizes 0-basiert)
 *   basisProStunde   = price >= 0 ? price : month-price[preisIndex]
 *   aufschlag        = Σ Preisaufschlag der gewählten Zusatzausstattungen (vom Controller als Summe übergeben)
 *   selbstbehaltAufschlag = [0.2, 0.0][selbstbehaltIndex]   // Index 0 = 1000€ → +0,20/h, 1 = 2500€ → +0/h
 *
 *   sumHour  = roundUp( nf2( basisProStunde + aufschlag + selbstbehaltAufschlag ) )
 *   sumMonth = nf2( sumHour × mietbetriebsstunden / mietdauer )   // Divisor = INKLUSIVE Mietdauer!
 *
 *   RUNDUNG — exakt wie PHP (cent-genauer Abgleich mit dem Bestandssystem gewünscht):
 *     nf2(x)       = (float)number_format(x, 2)   -> auf 2 NK runden (half away from zero)
 *     roundUp(x)   = ceil(x * 100) / 100          -> "Aufrunden" auf 2 NK
 *   Der roundUp/ceil erzeugt durch IEEE754-Float bei bestimmten Cent-Werten einen
 *   +1-Cent-Effekt (z. B. 17,60 -> 17,61). Das ist OriginalVERHALTEN der PHP und wird
 *   hier BEWUSST 1:1 nachgebildet (NICHT mit Epsilon "geglättet"), damit die Preise
 *   cent-genau dem alten/Live-System entsprechen. sumMonth wird aus dem bereits
 *   gerundeten sumHour gebildet und nur per nf2 (ohne ceil) auf 2 NK gebracht.
 */

(function (global) {
  'use strict';

  /** PHP number_format(x, 2): auf 2 Nachkommastellen runden (half away from zero). */
  function nf2(value) {
    return Number(Number(value).toFixed(2));
  }

  /** PHP roundUp(): ceil auf 2 NK. KEIN Epsilon — der Float-+1-Cent-Effekt ist gewollt (PHP-Treue). */
  function roundUpCents(value) {
    return Math.ceil(value * 100) / 100;
  }

  // Selbstbehalt-Aufschlag €/Stunde, indexiert wie der Slider: 0 = 1000€, 1 = 2500€.
  // Quelle: CalculationService.php  ->  $selbstbehalt = [0.2, 0.0];
  const SELBSTBEHALT_AUFSCHLAG = [0.2, 0.0];

  /**
   * Berechnet Stunden- und Monatspreis für eine Konfiguration.
   *
   * @param {object} tractor  Traktor-Objekt aus der Datenquelle (Struktur wie traktoren.json)
   * @param {object} opts
   * @param {number|string} opts.mietbetriebsstunden  Stunden-Stufe, z. B. 1000 (Slider-Wert, NICHT der Index)
   * @param {number} opts.mietdauer                   INKLUSIVE Mietdauer in Monaten = (mietende − mietstart) + 1, >= 1
   * @param {number} [opts.zusatzAufschlag=0]         Summe der €/h-Aufschläge der gewählten Zusatzausstattungen
   * @param {number} [opts.selbstbehaltIndex=1]       0 = 1000€ (+0,20/h) | 1 = 2500€ (+0/h)
   * @returns {{ sumHour: number, sumMonth: number } | null}  null bei ungültiger Eingabe
   */
  function calculatePrice(tractor, opts) {
    if (!tractor || !tractor.mietbetriebsstunden || !opts) return null;

    const {
      mietbetriebsstunden,
      mietdauer,
      zusatzAufschlag = 0,
      selbstbehaltIndex = 1,
    } = opts;

    const stufe = tractor.mietbetriebsstunden[String(mietbetriebsstunden)];
    if (!stufe) return null;

    // mietdauer wie PHP: <1 -> Fallback 2 (defensiv; die View liefert real >= 3)
    let dauer = Number(mietdauer);
    if (!Number.isFinite(dauer) || dauer < 1) dauer = 2;

    // basis: price >= 0 -> fester Stundenpreis (alte Berechnung), sonst month-price[mietdauer-1]
    let basisProStunde = Number(stufe.price);
    if (!Number.isFinite(basisProStunde) || basisProStunde < 0) {
      const mp = stufe['month-price'];
      if (!Array.isArray(mp)) return null;
      basisProStunde = mp[dauer - 1];
    }
    if (typeof basisProStunde !== 'number' || !Number.isFinite(basisProStunde)) return null;

    const aufschlagProStunde = Number(zusatzAufschlag) || 0;

    const sbAufschlag = SELBSTBEHALT_AUFSCHLAG[selbstbehaltIndex] || 0;

    // sumHour: erst auf 2 NK runden (number_format), dann roundUp/ceil — wie PHP.
    // sumHour wird gerundet, BEVOR sumMonth daraus berechnet wird (wie PHP).
    const sumHour = roundUpCents(nf2(basisProStunde + aufschlagProStunde + sbAufschlag));

    const stundenGesamt = Number(mietbetriebsstunden);
    const sumMonth = nf2((sumHour * stundenGesamt) / dauer);

    return { sumHour, sumMonth };
  }

  /**
   * Preisberechnung für die TELETRAK-Variante (Teleskoplader TLT).
   * ===================================================================
   * BEWUSST eine eigene Funktion — `calculatePrice()` oben ist cent-genau gegen
   * das alte PHP-System verifiziert und wird nicht angefasst.
   *
   * Zwei fachliche Unterschiede zur Standardformel:
   *
   *  1) Die Betriebsstunden sind hier bereits PRO MONAT angegeben. Der
   *     Monatspreis ist deshalb `sumHour × stundenProMonat` — es wird NICHT
   *     durch die Mietdauer geteilt.
   *
   *  2) KEIN roundUpCents(): Der ceil-auf-Float-Quirk in der Standardformel
   *     existiert nur, um die Preise der Bestandstraktoren cent-genau mit dem
   *     TYPO3-Altsystem übereinstimmen zu lassen. Die Teletraks wurden dort nie
   *     kalkuliert — es gibt also keine Kompatibilität zu wahren, und der Quirk
   *     würde nur einen Rundungsfehler erben. Gegengerechnet: in 3 von 108
   *     Kombinationen erzeugt er einen sichtbar falschen Preis (z. B.
   *     125 h/Monat, 36 Mon., SB 1.000 € → 20,11 statt 20,10 €/h).
   *
   * @param {object} tractor  Fahrzeug aus der Datenquelle (braucht `preise` je Stufe)
   * @param {object} opts
   * @param {number|string} opts.stundenProMonat   Stufe, z. B. 100 (Slider-WERT, nicht der Index)
   * @param {number} opts.dauerMonate              Mietdauer 12 | 24 | 36
   * @param {number} [opts.zusatzAufschlag=0]      Summe der €/h-Aufschläge der gewählten Anbaugeräte
   * @param {number} [opts.selbstbehaltIndex=1]    0 = 1000€ (+0,20/h) | 1 = 2500€ (+0/h)
   * @returns {{ sumHour: number, sumMonth: number } | null}
   */
  function calculatePriceTeletrak(tractor, opts) {
    if (!tractor || !tractor.mietbetriebsstunden || !opts) return null;

    const {
      stundenProMonat,
      dauerMonate,
      zusatzAufschlag = 0,
      selbstbehaltIndex = 1,
    } = opts;

    const stufe = tractor.mietbetriebsstunden[String(stundenProMonat)];
    if (!stufe || !Array.isArray(stufe.preise)) return null;

    // Dauerstufe -> Index in der Preisliste: 12 Mon. -> 0, 24 -> 1, 36 -> 2
    const idx = Math.round(Number(dauerMonate) / 12) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= stufe.preise.length) return null;

    const basis = stufe.preise[idx];
    if (typeof basis !== 'number' || !Number.isFinite(basis)) return null;

    const stunden = Number(stundenProMonat);
    if (!Number.isFinite(stunden) || stunden <= 0) return null;

    const sbAufschlag = SELBSTBEHALT_AUFSCHLAG[selbstbehaltIndex] || 0;
    const aufschlag = Number(zusatzAufschlag) || 0;

    const sumHour = nf2(basis + aufschlag + sbAufschlag);
    const sumMonth = nf2(sumHour * stunden);

    return { sumHour, sumMonth };
  }

  const Pricing = {
    calculatePrice,
    calculatePriceTeletrak,
    nf2,
    roundUpCents,
    SELBSTBEHALT_AUFSCHLAG,
  };

  // UMD-leicht: window.Pricing (Webflow Embed) + CommonJS (Node-Tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pricing;
  } else {
    global.Pricing = Pricing;
  }
})(typeof window !== 'undefined' ? window : globalThis);
