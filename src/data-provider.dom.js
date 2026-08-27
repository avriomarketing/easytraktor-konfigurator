/**
 * data-provider.dom.js — Datenquelle: liest die versteckte Webflow-Collection-Liste.
 * ==================================================================================
 *
 * Drop-in-Ersatz für den Mock-Provider (data-provider.js). GLEICHE Schnittstelle:
 *   TraktorRepository.getAll()  -> Promise<Record<modelName, Tractor>>
 *   TraktorRepository.getById() -> Promise<Tractor|null>
 *
 * Liest das DOM gemäß WEBFLOW-RENDER.md (Wurzel `.et-data`, Items `.et-fahrzeug`).
 * Der restliche Code (configurator/pricing) bleibt unverändert — er weiß nicht,
 * woher die Daten kommen.
 *
 * Tractor-Form (was dieser Provider liefert):
 *   {
 *     name, label,                         // Modellname (= Dropdown-Text)
 *     brand,                               // Markenfilter ("John Deere" …)
 *     link,                                // Datenblatt-URL (/produkte/<slug>)
 *     mietbetriebsstunden: { "1000": { "month-price": [0,0,…] }, … },
 *     extras: [ { key, label, preis, info, serie }, … ]   // datengetrieben aus CMS
 *   }
 */
(function (global) {
  'use strict';

  // Stundenstufen, für die ein `data-preise-<stufe>` gelesen wird.
  // 75/100/125 = Betriebsstunden PRO MONAT (Teletrak-Variante),
  // 200–1250 = Gesamt-Betriebsstunden (Standard/Traktoren).
  // Fehlt oder ist ein Attribut leer, wird die Stufe einfach nicht angeboten —
  // die beiden Sätze stören sich also nicht.
  var HOUR_TIERS = [75, 100, 125, 200, 300, 500, 750, 1000, 1250];
  var DETAIL_BASE = '/produkte/'; // Slug-Basis der Fahrzeuge-Collection-Detailseiten

  // "21,9" oder "21.9" -> 21.9 ; ungültig -> null
  function num(s) {
    if (s == null) return null;
    var v = parseFloat(String(s).trim().replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  // CSV -> Array von Zahlen. Leeres/fehlendes Feld -> null.
  function parseCsvNums(csv) {
    if (!csv || !String(csv).trim()) return null;
    var parts = String(csv).split(',').map(num).filter(function (v) { return v !== null; });
    return parts.length ? parts : null;
  }

  // Variante des Fahrzeugs: bestimmt Maske + Preislogik im Konfigurator.
  // Webflow kann Option-Felder NICHT an ein Custom Attribute binden (gleiche
  // Einschränkung wie beim Switch), daher primär über einen Marker-Div mit
  // Conditional Visibility. `data-variante` wird zusätzlich unterstützt, falls
  // der Wert doch mal als Text-Attribut geliefert wird.
  function readVariante(el) {
    if (el.querySelector('.et-variante-teletrak')) return 'teletrak';
    var v = (el.getAttribute('data-variante') || '').trim().toLowerCase();
    return v === 'teletrak' ? 'teletrak' : 'standard';
  }

  function parseExtras(scope, serie) {
    var out = [];
    if (!scope) return out;
    scope.querySelectorAll('.et-extra').forEach(function (el) {
      var labelEl = el.querySelector('.et-label');
      var infoEl = el.querySelector('.et-info');
      out.push({
        key: (el.getAttribute('data-key') || '').trim(),
        label: labelEl ? labelEl.textContent.trim() : '',
        preis: num(el.getAttribute('data-preis')) || 0,
        // Mietdauer-abhängige Aufschläge (Teletrak): 3 Werte für 12/24/36 Monate.
        // null = es gilt der Einzelwert aus `preis`.
        preisStaffel: parseCsvNums(el.getAttribute('data-preis-staffel')),
        info: infoEl ? infoEl.innerHTML.trim() : '',
        serie: !!serie,
      });
    });
    return out;
  }

  function readAll() {
    var data = {};
    document.querySelectorAll('.et-data .et-fahrzeug').forEach(function (el) {
      var name = (el.getAttribute('data-name') || '').trim();
      if (!name) return;

      // Marke aus data-hersteller am Item (Hersteller→Name; Hersteller ist Pflichtfeld).
      var brand = (el.getAttribute('data-hersteller') || '').trim();
      var slug = (el.getAttribute('data-slug') || '').trim();

      var mb = {};
      HOUR_TIERS.forEach(function (t) {
        var vals = parseCsvNums(el.getAttribute('data-preise-' + t));
        if (vals) {
          mb[String(t)] = {
            // Standard-Pfad: Index = Mietdauer − 1 (führende [0,0] wie in der alten JSON)
            'month-price': [0, 0].concat(vals),
            // Teletrak-Pfad: rohe Werte, Index = Dauerstufe (12→0, 24→1, 36→2)
            'preise': vals,
          };
        }
      });

      var extras = parseExtras(el.querySelector('.et-serie'), true)
        .concat(parseExtras(el.querySelector('.et-optional'), false));

      data[name] = {
        name: name,
        label: name,
        brand: brand,
        link: slug ? DETAIL_BASE + slug : '',
        variante: readVariante(el),
        mietbetriebsstunden: mb,
        extras: extras,
      };
    });
    return data;
  }

  // Hersteller-Status aus der versteckten Liste `.et-hersteller-data`.
  // Pro `.et-hersteller`: data-name (Pflicht), data-aktiv (Switch "true"/"false"),
  // optional data-logo. Robust: inaktiv, wenn data-aktiv false-artig ODER ein
  // `.et-inaktiv`-Marker vorhanden ist (Fallback via Conditional Visibility).
  function readHersteller() {
    var out = {};
    document.querySelectorAll('.et-hersteller-data .et-hersteller').forEach(function (el) {
      var name = (el.getAttribute('data-name') || '').trim();
      if (!name) return;
      var a = (el.getAttribute('data-aktiv') || '').trim().toLowerCase();
      var inaktivMarker = !!el.querySelector('.et-hersteller-inaktiv, .et-inaktiv');
      var aktiv = !inaktivMarker && a !== 'false' && a !== '0' && a !== 'no' && a !== 'off' && a !== 'nein' && a !== 'aus';
      out[name] = { name: name, aktiv: aktiv, logo: (el.getAttribute('data-logo') || '').trim() };
    });
    return out;
  }

  var TraktorRepository = {
    getAll: function () { return Promise.resolve(readAll()); },
    getById: function (id) { var all = readAll(); return Promise.resolve(all[id] || null); },
    // Record<herstellerName, { name, aktiv, logo }>. Leeres Objekt, wenn keine
    // Hersteller-Liste gerendert ist (dann gilt alles als verfügbar).
    getHersteller: function () { return Promise.resolve(readHersteller()); },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TraktorRepository;
  } else {
    global.TraktorRepository = TraktorRepository;
  }
})(typeof window !== 'undefined' ? window : globalThis);
