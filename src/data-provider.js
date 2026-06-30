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
