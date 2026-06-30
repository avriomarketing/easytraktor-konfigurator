/*!
 * easyTraktor Konfigurator — gebündelt
 * Enthält (in dieser Reihenfolge): pricing.js, data-provider.js, template.js, configurator.js
 * Quelle: /src — NICHT hier editieren, sondern in src/ ändern und neu bauen:
 *   node build.js
 */

/* ===== pricing.js ===== */
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
 *   aufschlag        = Σ stufe[zusatzleistung]      (rtk/fzw/les/zwa/pal/gre/erd/son)
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
   * @param {string[]} [opts.zusatzleistungen=[]]     angehakte Zusatzleistungen, z. B. ['fzw','rtk']
   * @param {number} [opts.selbstbehaltIndex=1]       0 = 1000€ (+0,20/h) | 1 = 2500€ (+0/h)
   * @returns {{ sumHour: number, sumMonth: number } | null}  null bei ungültiger Eingabe
   */
  function calculatePrice(tractor, opts) {
    if (!tractor || !tractor.mietbetriebsstunden || !opts) return null;

    const {
      mietbetriebsstunden,
      mietdauer,
      zusatzleistungen = [],
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

    const aufschlagProStunde = zusatzleistungen.reduce((sum, key) => {
      const v = stufe[key];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);

    const sbAufschlag = SELBSTBEHALT_AUFSCHLAG[selbstbehaltIndex] || 0;

    // sumHour: erst auf 2 NK runden (number_format), dann roundUp/ceil — wie PHP.
    // sumHour wird gerundet, BEVOR sumMonth daraus berechnet wird (wie PHP).
    const sumHour = roundUpCents(nf2(basisProStunde + aufschlagProStunde + sbAufschlag));

    const stundenGesamt = Number(mietbetriebsstunden);
    const sumMonth = nf2((sumHour * stundenGesamt) / dauer);

    return { sumHour, sumMonth };
  }

  const Pricing = { calculatePrice, nf2, roundUpCents, SELBSTBEHALT_AUFSCHLAG };

  // UMD-leicht: window.Pricing (Webflow Embed) + CommonJS (Node-Tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pricing;
  } else {
    global.Pricing = Pricing;
  }
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== data-provider.js ===== */
/**
 * data-provider.js — Datenquelle des Traktor-Konfigurators
 * ========================================================
 *
 * EINZIGE Stelle, die weiß, WOHER die Traktordaten kommen. Der restliche
 * Konfigurator kennt nur den unten definierten Vertrag (TraktorRepository)
 * und hat KEINE Ahnung über die Herkunft der Daten.
 *
 * Aktuell: MOCK — liefert statische Daten (aus traktoren.json, ergänzt um
 *          brand + label; Marke "Sonstige" ist herausgefiltert).
 * Später:  ersetzbar durch einen Provider, der dieselbe Schnittstelle erfüllt,
 *          aber aus der Webflow-Collection (display:none im DOM) oder per API liest.
 *          -> Nur DIESE Datei wird getauscht, der Rest bleibt unangetastet.
 *
 * ---------------------------------------------------------------------
 * VERTRAG (jede Implementierung MUSS das erfüllen)
 * ---------------------------------------------------------------------
 *   getAll()      : Promise<Record<string, TractorData>>
 *                   Alle Traktoren, keyed nach Modellname (z. B. "6180 TTV").
 *   getById(id)   : Promise<TractorData | null>
 *                   Ein Traktor nach Modellname, null wenn unbekannt.
 *
 * Beide Methoden sind async (Promise), damit ein späterer API-Provider
 * ohne Anpassung am Aufrufer passt.
 *
 * TractorData-Form (Vertrag des Rückgabewerts):
 *   {
 *     brand: string,                            // Marke, z. B. "Deutz-Fahr"
 *     label: string,                            // Anzeigename, z. B. "Deutz-Fahr 6180 TTV"
 *     mietbetriebsstunden: {
 *       "<stunden>": {                          // z. B. "500"
 *         price: number,                        // -1 = unbenutzt
 *         "month-price": number[],              // Index = Mietdauer in Monaten
 *         [zusatzleistung: string]: number      // Aufschlag €/Stunde (fzw, rtk, ...)
 *       }
 *     },
 *     zusatzausstattung: { [key: string]: number } // verfügbare Zusatzleistungen (UI-Status)
 *   }
 */

(function (global) {
  'use strict';

  // -- Statische Mock-Daten (aus traktoren.json + brand/label) ----------
  const MOCK_DATA = {
    "6M 125": {
      "brand": "John Deere",
      "label": "John Deere 6M 125",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            23.9,
            25.9,
            27.9,
            29.9,
            31.9,
            33.9,
            35.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.4,
            21.9,
            22.4,
            22.9,
            23.4,
            25.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            18.9,
            18.9,
            19.4,
            19.9,
            20.4,
            20.9,
            21.9,
            23.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            17.4,
            17.4,
            17.4,
            17.9,
            18.4,
            18.9,
            19.4,
            21.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            15.4,
            15.4,
            15.4,
            15.9,
            16.4,
            16.9,
            17.4,
            19.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6R 150": {
      "brand": "John Deere",
      "label": "John Deere 6R 150",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            24.9,
            28.9,
            31.9,
            35.9,
            38.9,
            40.9,
            42.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            28.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            20.9,
            21.4,
            21.9,
            22.4,
            22.9,
            23.4,
            25.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.4,
            19.4,
            19.4,
            19.9,
            20.4,
            20.9,
            21.4,
            22.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            16.9,
            16.9,
            16.9,
            17.4,
            17.9,
            18.4,
            18.9,
            20.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6R 185": {
      "brand": "John Deere",
      "label": "John Deere 6R 185",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            29.4,
            32.4,
            35.4,
            38.4,
            41.4,
            44.4,
            46.4,
            48.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            28.9,
            30.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            20.9,
            20.9,
            21.9,
            21.9,
            22.9,
            23.9,
            25.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            18.9,
            18.9,
            18.9,
            19.9,
            20.9,
            21.9,
            22.9,
            24.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6R 215": {
      "brand": "John Deere",
      "label": "John Deere 6R 215",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            30.9,
            31.9,
            36.9,
            39.9,
            42.9,
            45.9,
            48.9,
            51.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            31.9,
            33.9,
            35.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            23.9,
            24.9,
            26.9,
            27.9,
            28.9,
            29.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            22.9,
            22.9,
            23.9,
            24.9,
            25.4,
            25.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            20.9,
            20.9,
            22.9,
            23.9,
            24.9,
            25.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6M 220": {
      "brand": "John Deere",
      "label": "John Deere 6M 220",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            29.4,
            32.4,
            35.4,
            38.4,
            41.4,
            44.4,
            46.4,
            48.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            26.4,
            27.4,
            28.4,
            29.4,
            29.9,
            30.4,
            31.9,
            34.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.4,
            21.4,
            21.4,
            22.4,
            23.4,
            24.4,
            25.4,
            27.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            19.9,
            19.9,
            20.4,
            21.4,
            22.4,
            23.4,
            25.4
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6R 250": {
      "brand": "John Deere",
      "label": "John Deere 6R 250",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            33.9,
            34.9,
            38.9,
            43.9,
            49.9,
            52.9,
            55.9,
            57.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            28.9,
            29.9,
            32.9,
            34.9,
            35.9,
            36.9,
            37.9,
            39.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            32.9,
            34.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            23.9,
            23.9,
            23.9,
            25.9,
            26.9,
            27.9,
            28.9,
            30.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1,
        "les": 1,
        "zwa": 1
      }
    },
    "6180 TTV": {
      "brand": "Deutz-Fahr",
      "label": "Deutz-Fahr 6180 TTV",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            29.9,
            31.9,
            34.9,
            36.9,
            39.9,
            41.9,
            44.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            18.9,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            16.9,
            17.9,
            18.9,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 2,
        "rtk": 2,
        "les": 1,
        "zwa": 1
      }
    },
    "6230 TTV": {
      "brand": "Deutz-Fahr",
      "label": "Deutz-Fahr 6230 TTV",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            25.9,
            30.9,
            33.9,
            36.9,
            39.9,
            42.9,
            45.9,
            48.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            17.9,
            18.9,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 2,
        "rtk": 2,
        "les": 1,
        "zwa": 1
      }
    },
    "7250 TTV": {
      "brand": "Deutz-Fahr",
      "label": "Deutz-Fahr 7250 TTV",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            26.9,
            31.9,
            34.9,
            37.9,
            40.9,
            43.9,
            46.9,
            49.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9
          ],
          "fzw": 1,
          "rtk": 1.5,
          "les": 0.5,
          "zwa": 0.2
        }
      },
      "zusatzausstattung": {
        "fzw": 2,
        "rtk": 2,
        "les": 1,
        "zwa": 1
      }
    },
    "Puma 175": {
      "brand": "Case IH",
      "label": "Case IH Puma 175",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            28.9,
            31.9,
            33.9,
            34.9,
            36.9,
            38.9,
            40.9,
            42.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            26.9,
            27.9,
            28.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            24.9,
            24.9,
            25.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            23.9,
            23.9,
            24.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            17.9,
            18.9,
            19.9,
            20.9,
            21.9,
            21.9,
            22.9,
            23.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "Puma 260": {
      "brand": "Case IH",
      "label": "Case IH Puma 260",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            29.9,
            31.9,
            40.9,
            43.9,
            46.9,
            48.9,
            51.9,
            53.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            26.9,
            28.9,
            29.9,
            30.9,
            31.9,
            32.9,
            32.9,
            33.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            30.9,
            30.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            28.9,
            28.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            23.9,
            24.9,
            25.9,
            26.9,
            27.9,
            27.9,
            27.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "Maxxum 150": {
      "brand": "Case IH",
      "label": "Case IH Maxxum 150",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            28.9,
            29.9,
            31.9,
            33.9,
            34.9,
            36.9,
            38.9,
            39.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            20.9,
            21.9,
            22.9,
            23.9,
            24.9,
            24.9,
            24.9,
            25.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            23.9,
            23.9,
            24.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            16.9,
            17.9,
            18.9,
            19.9,
            20.9,
            20.9,
            20.9,
            21.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            15.9,
            16.9,
            17.9,
            18.9,
            19.9,
            19.9,
            19.9,
            20.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "Puma 165 MC": {
      "brand": "Case IH",
      "label": "Case IH Puma 165 MC",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            28.9,
            29.9,
            31.9,
            33.9,
            34.9,
            36.9,
            38.9,
            39.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            19.9,
            20.9,
            21.9,
            22.9,
            23.9,
            23.9,
            23.9,
            24.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            18.9,
            19.9,
            20.9,
            21.9,
            22.9,
            22.9,
            22.9,
            23.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            15.9,
            16.9,
            17.9,
            18.9,
            19.9,
            19.9,
            19.9,
            20.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            14.9,
            15.9,
            16.9,
            17.9,
            18.9,
            18.9,
            18.9,
            19.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "Puma 220": {
      "brand": "Case IH",
      "label": "Case IH Puma 220",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            28.9,
            30.9,
            38.9,
            41.9,
            43.9,
            45.9,
            48.9,
            50.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            23.9,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            30.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            28.9,
            28.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            26.9,
            26.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            25.9,
            25.9,
            26.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "Puma 220 MC": {
      "brand": "Case IH",
      "label": "Case IH Puma 220 MC",
      "mietbetriebsstunden": {
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            34.9,
            36.9,
            38.9,
            41.9,
            43.9,
            45.9,
            48.9,
            50.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            25.9,
            26.9,
            27.9,
            28.9,
            29.9,
            30.9,
            30.9,
            31.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            24.9,
            25.9,
            26.9,
            27.9,
            28.9,
            28.9,
            28.9,
            29.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1000": {
          "price": -1,
          "month-price": [
            0,
            0,
            22.9,
            23.9,
            24.9,
            25.9,
            26.9,
            26.9,
            26.9,
            27.9
          ],
          "fzw": 1,
          "rtk": 1
        },
        "1250": {
          "price": -1,
          "month-price": [
            0,
            0,
            21.9,
            22.9,
            23.9,
            24.9,
            25.9,
            25.9,
            25.9,
            26.9
          ],
          "fzw": 1,
          "rtk": 1
        }
      },
      "zusatzausstattung": {
        "fzw": 1,
        "rtk": 1
      }
    },
    "542-70 AGRI SUPER": {
      "brand": "JCB",
      "label": "JCB 542-70 AGRI SUPER",
      "mietbetriebsstunden": {
        "200": {
          "price": -1,
          "month-price": [
            0,
            0,
            35,
            36,
            37,
            38,
            39,
            40,
            40,
            40
          ],
          "pal": 0,
          "erd": 0.5,
          "gre": 1,
          "son": 0
        },
        "300": {
          "price": -1,
          "month-price": [
            0,
            0,
            28,
            29,
            30,
            31,
            32,
            33,
            33,
            33
          ],
          "pal": 0,
          "erd": 0.5,
          "gre": 1,
          "son": 0
        },
        "500": {
          "price": -1,
          "month-price": [
            0,
            0,
            23.5,
            24,
            24.5,
            25,
            25.5,
            26,
            26,
            26
          ],
          "pal": 0,
          "erd": 0.5,
          "gre": 1,
          "son": 0
        },
        "750": {
          "price": -1,
          "month-price": [
            0,
            0,
            19,
            19.5,
            20,
            20.5,
            21,
            21.5,
            21.5,
            23.5
          ],
          "pal": 0,
          "erd": 0.5,
          "gre": 1,
          "son": 0
        }
      },
      "zusatzausstattung": {
        "pal": 1,
        "erd": 1,
        "gre": 1,
        "son": 1
      }
    }
  };

  // -- Mock-Implementierung des Vertrags --------------------------------
  const TraktorRepository = {
    /** @returns {Promise<Record<string, object>>} */
    getAll() {
      // Defensiv klonen, damit Aufrufer die Quelle nicht versehentlich mutiert.
      return Promise.resolve(JSON.parse(JSON.stringify(MOCK_DATA)));
    },

    /** @param {string} id Modellname @returns {Promise<object|null>} */
    getById(id) {
      const t = MOCK_DATA[id];
      return Promise.resolve(t ? JSON.parse(JSON.stringify(t)) : null);
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TraktorRepository;
  } else {
    global.TraktorRepository = TraktorRepository;
  }
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== template.js ===== */
/**
 * template.js — View-Markup des Konfigurators (als String)
 * ========================================================
 *
 * Das "View"-Gerüst. Wird vom Controller (configurator.js) in den leeren
 * Wrapper `.et-konfigurator` injiziert (Full-Injection-Ansatz). So enthält
 * das Webflow-Embed nur noch <link>, ein leeres <div> und <script> — das
 * komplette Markup wird über das CDN ausgeliefert und gewartet.
 *
 * SEO-Hinweis: Dieser Inhalt ist ein reines Funktionstool (Slider, Dropdowns,
 * Preisausgabe) und kein Ranking-Asset. Ranking-relevanter Text (H1, Fließtext,
 * Modell-Beschreibungen) lebt im Webflow-CMS-Markup der Seite, nicht hier.
 *
 * ⚠️ Hersteller-Logos zeigen noch auf temporäre Figma-Asset-URLs — vor Livegang
 *    neu hosten und die vier <img src> hier ersetzen. data-brand NICHT ändern.
 *
 * ---------------------------------------------------------------------
 * SO EDITIERST DU DAS MARKUP (auch ohne JS-Kenntnisse)
 * ---------------------------------------------------------------------
 *  - Das HTML steht unten zwischen den beiden Backticks ` (TEMPLATE = `...`).
 *    Dazwischen ist es ganz normales HTML: Texte, <img src>, Reihenfolge usw.
 *    einfach wie gewohnt ändern.
 *  - NICHT anfassen: die data-* Attribute (data-config, data-brand, data-dropdown,
 *    data-slider, data-extra, data-output) — daran hängt die Logik.
 *  - Drei Zeichen brechen den String, also im Markup VERMEIDEN bzw. escapen:
 *      Backtick  `   ->   &#96;
 *      ${               ->   &#36;{   (das Dollar-Geschweifte zusammen)
 *      Backslash \      ->   normalerweise nicht nötig, einfach weglassen
 *  - Tipp VS Code: der HTML-Highlight-Marker direkt vor dem Backtick (siehe
 *    Code unten) aktiviert HTML-Highlighting im String (Extension "es6-string-html").
 *  - NACH dem Ändern IMMER:  node build.js   -> erzeugt dist/ neu -> aufs CDN.
 *    Direkt in dist/ editieren bringt nichts (wird beim Build überschrieben).
 */
(function () {
  'use strict';

  const TEMPLATE = /*html*/ `
  <div class="calc" data-config>
    <div class="calc__header">
      <span class="calc__title">Traktor-Miete online kalkulieren</span>
    </div>

    <div class="calc__body">

      <label class="calc__label">Herstellerauswahl</label>
      <div class="calc__manufacturers">
        <button class="calc__manufacturer calc__manufacturer--active" data-brand="John Deere">
          <img src="https://www.figma.com/api/mcp/asset/d8bae476-1849-4cab-98db-21a4b4770d68" alt="John Deere">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="Case IH">
          <img src="https://www.figma.com/api/mcp/asset/9ad759f9-a301-4e60-9272-5e78882ab6c1" alt="Case IH">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="JCB">
          <img src="https://www.figma.com/api/mcp/asset/2830f487-84d1-4d60-83a5-2c5dacc1e027" alt="JCB">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="Deutz-Fahr">
          <img src="https://www.figma.com/api/mcp/asset/3c1834a1-d75b-4757-b1e4-d418f13196c8" alt="Deutz-Fahr">
        </button>
      </div>

      <!-- Modell Dropdown + Datenblatt-Button — Items datengetrieben, href via Controller (tractor.link) -->
      <label class="calc__label">Modell</label>
      <div class="calc__model-row">
        <div class="calc__dropdown" data-dropdown="model">
          <div class="calc__dropdown-trigger" data-dropdown-trigger>
            <span class="calc__dropdown-value">–</span>
            <span class="calc__dropdown-arrow">&#9660;</span>
          </div>
          <ul class="calc__dropdown-list"></ul>
        </div>
        <a class="calc__datasheet" data-datasheet target="_blank" rel="noopener" aria-label="Zum Datenblatt des ausgewählten Fahrzeugs">
          <svg class="calc__datasheet-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><g fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C8.68629 2 6 4.68629 6 8V40C6 43.3137 8.68629 46 12 46H36C39.3137 46 42 43.3137 42 40V8C42 4.68629 39.3137 2 36 2H12ZM12 8H36V22H12V8ZM36 25H12V28H36V25ZM12 31H36V34H12V31ZM26 37H12V40H26V37Z" fill="#ffffff"></path></g></svg>
          <span class="calc__tooltip calc__tooltip--datasheet">Zum Datenblatt des ausgewählten Fahrzeugs</span>
        </a>
      </div>

      <!-- Mietstart / Mietende — Items werden vom Controller befüllt -->
      <div class="calc__dates">
        <div class="calc__date-group">
          <label class="calc__label">Mietstart</label>
          <div class="calc__dropdown calc__dropdown--pill" data-dropdown="start">
            <div class="calc__dropdown-trigger" data-dropdown-trigger>
              <span class="calc__dropdown-value">–</span>
              <span class="calc__dropdown-arrow">&#9660;</span>
            </div>
            <ul class="calc__dropdown-list"></ul>
          </div>
        </div>
        <div class="calc__date-group">
          <label class="calc__label">Mietende</label>
          <div class="calc__dropdown calc__dropdown--pill" data-dropdown="end">
            <div class="calc__dropdown-trigger" data-dropdown-trigger>
              <span class="calc__dropdown-value">–</span>
              <span class="calc__dropdown-arrow">&#9660;</span>
            </div>
            <ul class="calc__dropdown-list"></ul>
          </div>
        </div>
      </div>

      <!-- Betriebsstunden Slider — rastet auf die Stufen des Modells -->
      <div class="calc__slider-group">
        <div class="calc__slider-header">
          <span class="calc__slider-label">
            <span class="calc__label">Mietbetriebsstunden:</span>
            <span class="calc__info-tip">
              i
              <span class="calc__tooltip">Jede weitere Mietstunde wird gemäß der vereinbarten Mietbedingungen abgerechnet.</span>
            </span>
          </span>
          <span class="calc__slider-value" data-slider-value="stunden">–</span>
        </div>
        <div class="calc__slider-track">
          <input type="range" class="calc__range" data-slider="stunden" min="0" max="5" value="3">
        </div>
      </div>

      <!-- Selbstbehalt Slider — 2 Stufen (1000 / 2500) -->
      <div class="calc__slider-group">
        <div class="calc__slider-header">
          <span class="calc__slider-label">
            <span class="calc__label">Gewünschter Selbstbehalt:</span>
            <span class="calc__info-tip">
              i
              <span class="calc__tooltip">Der Selbstbehalt ist auf die Maschinenbruchversicherung pro Schadensfall zu zahlen.</span>
            </span>
          </span>
          <span class="calc__slider-value" data-slider-value="selbstbehalt">–</span>
        </div>
        <div class="calc__slider-track">
          <input type="range" class="calc__range" data-slider="selbstbehalt" min="0" max="1" value="1">
        </div>
      </div>

      <!-- Zusatzausstattung — data-extra = Schlüssel im Datensatz -->
      <p class="calc__label calc__label--section">Zusatzausstattung</p>
      <div class="calc__checkboxes">
        <label class="calc__checkbox-label">
          <input type="checkbox" class="calc__checkbox-input" data-extra="les">
          <span class="calc__checkbox-box"></span>
          Lenksystem
          <span class="calc__info-tip">
            i
            <span class="calc__tooltip">GPS-Lenksystem mit bis zu 15 cm Spurgenauigkeit.</span>
          </span>
        </label>
        <label class="calc__checkbox-label">
          <input type="checkbox" class="calc__checkbox-input" data-extra="rtk">
          <span class="calc__checkbox-box"></span>
          Lenksystem RTK
          <span class="calc__info-tip">
            i
            <span class="calc__tooltip">
                   <p>Hochpräzises RTK-GPS-Lenksystem mit bis zu 2 cm Genauigkeit und wiederholbaren Spuren.</p>
                   <ul>
                       <li>Maximale Produktivität durch höchstmögliche Fahrgenauigkeit (max. 3 cm)</li>
                       <li>Schnelle Integration in vorhandene Agrar- und Flottenmanagementsoftware</li>
                       <li>Entlastung des Fahrers und maximaler Bedienkomfort</li>
                   </ul>
            </span>
          </span>
        </label>
        <label class="calc__checkbox-label">
          <input type="checkbox" class="calc__checkbox-input" data-extra="fzw">
          <span class="calc__checkbox-box"></span>
          Frontzapfwelle
          <span class="calc__info-tip">
            i
            <span class="calc__tooltip">Original Frontzapfwelle ab Werk.</span>
          </span>
        </label>
        <label class="calc__checkbox-label">
          <input type="checkbox" class="calc__checkbox-input" data-extra="zwa">
          <span class="calc__checkbox-box"></span>
          Zwangslenkung
          <span class="calc__info-tip">
            i
            <span class="calc__tooltip">Beidseitige K50-Kupplung für Anhänger mit Zwangslenkung.</span>
          </span>
        </label>
      </div>

      <!-- Price — NUR der <span data-output> wird vom Controller beschrieben (die
           reine Zahl). Der restliche Text drumherum ist frei im HTML editierbar. -->
      <div class="calc__price-section">
        <p class="calc__price-value">nur <span data-output="sumHour">–</span> € / Betriebsstunde</p>
        <p class="calc__price-sub">Monatlicher Mietpreis: <span data-output="sumMonth">–</span> EUR</p>
        <p class="calc__price-note">Bei allen Werten handelt es sich um Nettowerte.</p>
      </div>

      <button class="calc__cta">
        Angebot anfordern
        <span class="calc__cta-arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><title>arrow-right</title><g fill="#EE7500"> <path fill-rule="evenodd" clip-rule="evenodd" d="M4 22.5L42 22.5L42 25.5L4 25.5L4 22.5Z" fill="#EE7500"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M25.8787 9.99998L39.8787 24L25.8787 38L28 40.1213L44.1213 24L28 7.87866L25.8787 9.99998Z" fill="#EE7500"></path> </g></svg>
        </span>
      </button>

    </div>
  </div>
  `;

  // UMD: Webflow (window) + Node-Tests (CommonJS)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TEMPLATE;
  } else {
    window.KonfiguratorTemplate = TEMPLATE;
  }
})();


/* ===== configurator.js ===== */
/**
 * configurator.js — Controller des Traktor-Konfigurators
 * ======================================================
 *
 * Das "Control" im MVC. Verdrahtet View (HTML/CSS in Webflow) mit dem Model
 * (data-provider.js = woher die Daten kommen, pricing.js = wie gerechnet wird).
 *
 * Enthält SELBST keine Daten und keine Preisformel. Aufgaben:
 *   1. auf Eingaben in der View hören (Marke, Modell, Slider, Datepicker, Checkboxen)
 *   2. Daten vom Model holen  -> TraktorRepository.getAll()/getById()
 *   3. Zustand der View einsammeln -> Pricing.calculatePrice(...)
 *   4. Ergebnis (sumHour/sumMonth) zurück in die View schreiben
 *
 * Abhängigkeiten (müssen VOR diesem Script geladen sein):
 *   - window.TraktorRepository  (data-provider.js)
 *   - window.Pricing            (pricing.js)
 *
 * ---------------------------------------------------------------------
 * DOM-VERTRAG (diese data-Attribute/IDs erwartet der Controller in der View)
 * ---------------------------------------------------------------------
 *   [data-config]                  Wurzel-Container des Konfigurators (Pflicht)
 *   .calc__manufacturer[data-brand="John Deere"]   Marken-Button (Filter)
 *      -> aktiver Button trägt zusätzlich .calc__manufacturer--active
 *   [data-dropdown="model"]        Modell-Dropdown (Items werden datengetrieben befüllt)
 *   [data-dropdown="start"]        Mietstart-Dropdown (datengetrieben)
 *   [data-dropdown="end"]          Mietende-Dropdown (datengetrieben)
 *      jedes Dropdown enthält [data-dropdown-trigger] > .calc__dropdown-value
 *      und eine Liste .calc__dropdown-list
 *   [data-slider="stunden"]        Range-Input Betriebsstunden (rastet auf Modell-Stufen)
 *   [data-slider-value="stunden"]  Anzeige des Stundenwerts
 *   [data-slider="selbstbehalt"]   Range-Input Selbstbehalt (2 Stufen)
 *   [data-slider-value="selbstbehalt"]  Anzeige des Selbstbehalts
 *   .calc__checkbox-input[data-extra="rtk"]   Zusatzleistung (Schlüssel = data-extra)
 *      -> die umschließende .calc__checkbox-label wird je Modell ein-/ausgeblendet
 *   [data-output="sumHour"]        Ausgabe €/Stunde
 *   [data-output="sumMonth"]       Ausgabe €/Monat
 */

(function () {
  'use strict';

  // ── Konfiguration (View-seitige Konstanten, keine Preislogik) ─────────
  const MONTHS = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November',
  ];
  const START_YEAR = 2026;
  const MIN_MIETDAUER = 2;           // Monate
  const MAX_MIETDAUER = 9;           // letzter belegter Index in month-price
  const SELBSTBEHALT = [1000, 2500]; // EUR-Stufen

  const eur = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Laufzeit-Zustand ──────────────────────────────────────────────────
  const state = {
    allData: {},        // Record<modelName, TractorData>
    brand: null,        // aktiver Markenfilter (null = alle)
    model: null,        // gewählter Modellname
    stundenTiers: [],   // verfügbare Stundenstufen des Modells, z. B. [300,500,750,...]
    stundenIndex: 0,
    selbstbehaltIndex: 1,
    startIndex: 3,      // Default April
    endIndex: 5,        // Default Juni
  };

  // ── DOM-Referenzen ────────────────────────────────────────────────────
  let root, dom;

  // robust für Webflow: Script kann im Footer laden, wenn DOM schon fertig ist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Markup ins leere Wrapper-Div injizieren (Full-Injection).
  // Das Webflow-Embed liefert nur <div class="et-konfigurator"></div> —
  // das eigentliche View-Gerüst kommt aus template.js (über das CDN gewartet).
  function mountTemplate() {
    const tpl = (typeof window !== 'undefined' && window.KonfiguratorTemplate)
      || (typeof KonfiguratorTemplate !== 'undefined' ? KonfiguratorTemplate : null);
    if (!tpl) return;
    document.querySelectorAll('.et-konfigurator').forEach((wrapper) => {
      // nur befüllen, wenn noch kein Markup vorhanden ist (idempotent)
      if (!wrapper.querySelector('[data-config]')) {
        wrapper.innerHTML = tpl;
      }
    });
  }

  async function init() {
    mountTemplate();

    root = document.querySelector('[data-config]');
    if (!root) return; // Konfigurator nicht auf dieser Seite

    dom = {
      brands: root.querySelectorAll('.calc__manufacturer[data-brand]'),
      modelDd: root.querySelector('[data-dropdown="model"]'),
      datasheet: root.querySelector('[data-datasheet]'),
      startDd: root.querySelector('[data-dropdown="start"]'),
      endDd: root.querySelector('[data-dropdown="end"]'),
      stunden: root.querySelector('[data-slider="stunden"]'),
      stundenVal: root.querySelector('[data-slider-value="stunden"]'),
      selbst: root.querySelector('[data-slider="selbstbehalt"]'),
      selbstVal: root.querySelector('[data-slider-value="selbstbehalt"]'),
      checkboxes: root.querySelectorAll('.calc__checkbox-input[data-extra]'),
      outHour: root.querySelector('[data-output="sumHour"]'),
      outMonth: root.querySelector('[data-output="sumMonth"]'),
    };

    state.allData = await TraktorRepository.getAll();

    setupDropdownToggles();
    setupBrandButtons();
    setupSliders();
    setupCheckboxes();
    renderDateDropdowns();

    // Erstauswahl: erste verfügbare Marke + erstes Modell
    const firstActive = root.querySelector('.calc__manufacturer--active[data-brand]');
    state.brand = firstActive ? firstActive.getAttribute('data-brand') : null;
    renderModelDropdown();
    selectFirstModel();

    recalc();
  }

  // ── Marken-Buttons (Filter) ───────────────────────────────────────────
  function setupBrandButtons() {
    dom.brands.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        dom.brands.forEach((b) => {
          b.classList.remove('calc__manufacturer--active');
          b.classList.add('calc__manufacturer--inactive');
        });
        btn.classList.add('calc__manufacturer--active');
        btn.classList.remove('calc__manufacturer--inactive');
        state.brand = btn.getAttribute('data-brand');
        renderModelDropdown();
        selectFirstModel();
        recalc();
      });
    });
  }

  // ── Modell-Dropdown (datengetrieben) ──────────────────────────────────
  function modelsForBrand() {
    return Object.keys(state.allData).filter((name) => {
      if (!state.brand) return true;
      return state.allData[name].brand === state.brand;
    });
  }

  function renderModelDropdown() {
    const list = dom.modelDd.querySelector('.calc__dropdown-list');
    const models = modelsForBrand();
    list.innerHTML = '';
    models.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'calc__dropdown-item';
      li.setAttribute('data-model', name);
      li.textContent = state.allData[name].label || name;
      li.addEventListener('click', () => {
        selectModel(name);
        closeDropdown(dom.modelDd);
        recalc();
      });
      list.appendChild(li);
    });
  }

  function selectFirstModel() {
    const models = modelsForBrand();
    if (models.length) selectModel(models[0]);
  }

  function selectModel(name) {
    state.model = name;
    const tractor = state.allData[name];

    // Trigger-Text + Selektion in der Liste
    setDropdownValue(dom.modelDd, tractor.label || name);
    dom.modelDd.querySelectorAll('.calc__dropdown-item').forEach((li) => {
      li.classList.toggle('calc__dropdown-item--selected', li.getAttribute('data-model') === name);
    });

    // Datenblatt-Button: Link des gewählten Fahrzeugs setzen (kommt aus der Datenquelle).
    // Kein Link (z. B. Mock-Daten) -> Button bleibt sichtbar, ist aber nicht navigierbar.
    if (dom.datasheet) {
      const link = tractor.link;
      if (link) dom.datasheet.setAttribute('href', link);
      else dom.datasheet.removeAttribute('href');
    }

    // Stunden-Stufen des Modells übernehmen
    state.stundenTiers = Object.keys(tractor.mietbetriebsstunden)
      .map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
    configureStundenSlider();
    updateCheckboxAvailability(tractor);
  }

  // ── Datums-Dropdowns ──────────────────────────────────────────────────
  function renderDateDropdowns() {
    renderStartOptions();
    renderEndOptions();
  }

  function renderStartOptions() {
    const list = dom.startDd.querySelector('.calc__dropdown-list');
    list.innerHTML = '';
    // Start nur so spät, dass mind. MIN_MIETDAUER Monate übrig bleiben
    const lastStart = MONTHS.length - 1 - MIN_MIETDAUER;
    for (let i = 0; i <= lastStart; i++) {
      list.appendChild(makeMonthItem(i, () => {
        state.startIndex = i;
        setDropdownValue(dom.startDd, monthLabel(i));
        markSelected(list, i);
        // Mietende ggf. nachziehen
        if (state.endIndex < i + MIN_MIETDAUER) state.endIndex = i + MIN_MIETDAUER;
        renderEndOptions();
        closeDropdown(dom.startDd);
        recalc();
      }));
    }
    setDropdownValue(dom.startDd, monthLabel(state.startIndex));
    markSelected(list, state.startIndex);
  }

  function renderEndOptions() {
    const list = dom.endDd.querySelector('.calc__dropdown-list');
    list.innerHTML = '';
    const first = state.startIndex + MIN_MIETDAUER;
    const last = Math.min(MONTHS.length - 1, state.startIndex + MAX_MIETDAUER);
    for (let i = first; i <= last; i++) {
      list.appendChild(makeMonthItem(i, () => {
        state.endIndex = i;
        setDropdownValue(dom.endDd, monthLabel(i));
        markSelected(list, i);
        closeDropdown(dom.endDd);
        recalc();
      }));
    }
    setDropdownValue(dom.endDd, monthLabel(state.endIndex));
    markSelected(list, state.endIndex);
  }

  function makeMonthItem(index, onClick) {
    const li = document.createElement('li');
    li.className = 'calc__dropdown-item';
    li.setAttribute('data-month-index', String(index));
    li.textContent = monthLabel(index);
    li.addEventListener('click', onClick);
    return li;
  }

  function monthLabel(i) { return MONTHS[i] + ' ' + START_YEAR; }

  function markSelected(list, index) {
    list.querySelectorAll('.calc__dropdown-item').forEach((li) => {
      li.classList.toggle('calc__dropdown-item--selected',
        li.getAttribute('data-month-index') === String(index));
    });
  }

  // ── Slider ────────────────────────────────────────────────────────────
  function setupSliders() {
    if (dom.stunden) dom.stunden.addEventListener('input', () => {
      state.stundenIndex = Number(dom.stunden.value);
      paintStundenValue();
      paintTrack(dom.stunden);
      recalc();
    });
    if (dom.selbst) {
      dom.selbst.min = 0; dom.selbst.max = SELBSTBEHALT.length - 1; dom.selbst.step = 1;
      dom.selbst.value = state.selbstbehaltIndex;
      dom.selbst.addEventListener('input', () => {
        state.selbstbehaltIndex = Number(dom.selbst.value);
        paintSelbstValue();
        paintTrack(dom.selbst);
        recalc();
      });
      paintSelbstValue();
      paintTrack(dom.selbst);
    }
  }

  // Slider auf die diskreten Stunden-Stufen des Modells einstellen
  function configureStundenSlider() {
    if (!dom.stunden || !state.stundenTiers.length) return;
    const maxIdx = state.stundenTiers.length - 1;
    dom.stunden.min = 0; dom.stunden.max = maxIdx; dom.stunden.step = 1;
    // Default je Modell: zweithöchste Stufe (wie alte Seite)
    state.stundenIndex = Math.max(0, maxIdx - 1);
    dom.stunden.value = state.stundenIndex;
    paintStundenValue();
    paintTrack(dom.stunden);
  }

  function paintStundenValue() {
    if (dom.stundenVal) dom.stundenVal.textContent = state.stundenTiers[state.stundenIndex];
  }
  function paintSelbstValue() {
    if (dom.selbstVal) dom.selbstVal.textContent = SELBSTBEHALT[state.selbstbehaltIndex] + ' EUR';
  }
  // Füllbalken-Prozent wie in der View (CSS-Variable --pct)
  function paintTrack(input) {
    const pct = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--pct', (Number.isFinite(pct) ? pct : 0) + '%');
  }

  // ── Checkboxen (Zusatzleistungen) ─────────────────────────────────────
  function setupCheckboxes() {
    dom.checkboxes.forEach((cb) => cb.addEventListener('change', recalc));
  }

  // Pro Modell ein-/ausblenden: nur verfügbare Zusatzleistungen zeigen
  function updateCheckboxAvailability(tractor) {
    const available = tractor.zusatzausstattung || {};
    dom.checkboxes.forEach((cb) => {
      const key = cb.getAttribute('data-extra');
      const label = cb.closest('.calc__checkbox-label');
      const isAvailable = Object.prototype.hasOwnProperty.call(available, key);
      if (label) label.style.display = isAvailable ? '' : 'none';
      if (!isAvailable) cb.checked = false;
    });
  }

  function selectedExtras() {
    const extras = [];
    dom.checkboxes.forEach((cb) => {
      const label = cb.closest('.calc__checkbox-label');
      const hidden = label && label.style.display === 'none';
      if (cb.checked && !hidden) extras.push(cb.getAttribute('data-extra'));
    });
    return extras;
  }

  // ── Generisches Dropdown-Auf/Zu (Präsentation) ────────────────────────
  function setupDropdownToggles() {
    root.querySelectorAll('[data-dropdown]').forEach((dd) => {
      const trigger = dd.querySelector('[data-dropdown-trigger]');
      if (!trigger) return;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = dd.classList.contains('is-open');
        root.querySelectorAll('[data-dropdown]').forEach((d) => d.classList.remove('is-open'));
        if (!open) dd.classList.add('is-open');
      });
    });
    document.addEventListener('click', () => {
      root.querySelectorAll('[data-dropdown]').forEach((d) => d.classList.remove('is-open'));
    });
  }
  function closeDropdown(dd) { dd.classList.remove('is-open'); }
  function setDropdownValue(dd, text) {
    const v = dd.querySelector('.calc__dropdown-value');
    if (v) v.textContent = text;
  }

  // ── Berechnung anstoßen + Ergebnis schreiben ──────────────────────────
  function recalc() {
    const tractor = state.allData[state.model];
    if (!tractor) return;

    const result = Pricing.calculatePrice(tractor, {
      mietbetriebsstunden: state.stundenTiers[state.stundenIndex],
      // INKLUSIVE Mietdauer wie PHP: (mietende − mietstart) + 1
      mietdauer: (state.endIndex - state.startIndex) + 1,
      zusatzleistungen: selectedExtras(),
      selbstbehaltIndex: state.selbstbehaltIndex,
    });

    if (!result) return;
    // Nur die reine Zahl in den <span data-output> schreiben — der umgebende
    // Text (z. B. "nur … € / Betriebsstunde") bleibt frei im HTML editierbar.
    if (dom.outHour) dom.outHour.textContent = eur.format(result.sumHour);
    if (dom.outMonth) dom.outMonth.textContent = eur.format(result.sumMonth);
  }
})();
