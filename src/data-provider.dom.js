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

  var HOUR_TIERS = [200, 300, 500, 750, 1000, 1250];
  var DETAIL_BASE = '/produkte/'; // Slug-Basis der Fahrzeuge-Collection-Detailseiten

  // "21,9" oder "21.9" -> 21.9 ; ungültig -> null
  function num(s) {
    if (s == null) return null;
    var v = parseFloat(String(s).trim().replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  // CSV (8 Werte, Mietdauer 2–9 Mon.) -> month-price-Array mit führenden [0,0].
  // Leeres/fehlendes Feld -> null (Stufe wird nicht angeboten).
  function parsePreise(csv) {
    if (!csv || !String(csv).trim()) return null;
    var parts = String(csv).split(',').map(num).filter(function (v) { return v !== null; });
    if (!parts.length) return null;
    return [0, 0].concat(parts);
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
        var mp = parsePreise(el.getAttribute('data-preise-' + t));
        if (mp) mb[String(t)] = { 'month-price': mp };
      });

      var extras = parseExtras(el.querySelector('.et-serie'), true)
        .concat(parseExtras(el.querySelector('.et-optional'), false));

      data[name] = {
        name: name,
        label: name,
        brand: brand,
        link: slug ? DETAIL_BASE + slug : '',
        mietbetriebsstunden: mb,
        extras: extras,
      };
    });
    return data;
  }

  var TraktorRepository = {
    getAll: function () { return Promise.resolve(readAll()); },
    getById: function (id) { var all = readAll(); return Promise.resolve(all[id] || null); },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TraktorRepository;
  } else {
    global.TraktorRepository = TraktorRepository;
  }
})(typeof window !== 'undefined' ? window : globalThis);
