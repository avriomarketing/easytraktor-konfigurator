/*!
 * easyTraktor Konfigurator — gebündelt
 * Enthält (in dieser Reihenfolge): pricing.js, data-provider.dom.js, template.js, configurator.js
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

  const Pricing = { calculatePrice, nf2, roundUpCents, SELBSTBEHALT_AUFSCHLAG };

  // UMD-leicht: window.Pricing (Webflow Embed) + CommonJS (Node-Tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pricing;
  } else {
    global.Pricing = Pricing;
  }
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== data-provider.dom.js ===== */
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
          <img src="https://cdn.prod.website-files.com/6a158657dd2577add4c791dd/6a2e4620278a501dda073422_JohnDeere.png" alt="John Deere">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="Case IH">
          <img src="https://cdn.prod.website-files.com/6a158657dd2577add4c791dd/6a2e460e11f6e3241478bb9a_Case.png" alt="Case IH">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="JCB">
          <img src="https://cdn.prod.website-files.com/6a158657dd2577add4c791dd/6a2e4618bc0e9d85ec33e867_JCB.png" alt="JCB">
        </button>
        <button class="calc__manufacturer calc__manufacturer--inactive" data-brand="Deutz-Fahr">
          <img src="https://cdn.prod.website-files.com/6a158657dd2577add4c791dd/6a2e460597912c7657c5615e_Deutz.png" alt="Deutz-Fahr">
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

      <!-- Zusatzausstattung — datengetrieben: der Controller füllt [data-extras]
           aus tractor.extras (Serien = vorausgewählt+gesperrt, Optionale frei wählbar).
           Ganze Sektion wird ausgeblendet, wenn das Fahrzeug keine Extras hat. -->
      <div data-extras-section>
        <p class="calc__label calc__label--section">Zusatzausstattung</p>
        <div class="calc__checkboxes" data-extras></div>
      </div>

      <!-- Price — NUR der <span data-output> wird vom Controller beschrieben (die
           reine Zahl). Der restliche Text drumherum ist frei im HTML editierbar. -->
      <div class="calc__price-section">
        <p class="calc__price-value">nur <span data-output="sumHour">–</span> € / Betriebsstunde</p>
        <p class="calc__price-sub">Monatlicher Mietpreis: <span data-output="sumMonth">–</span> EUR</p>
        <p class="calc__price-note">Bei allen Werten handelt es sich um Nettowerte.</p>
      </div>

      <button class="calc__cta" type="button" data-submit>
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
  const TYPEFORM_ID = 'tyctUmUQ';    // Angebots-Formular (Popup)

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
      extrasSection: root.querySelector('[data-extras-section]'),
      extrasContainer: root.querySelector('[data-extras]'),
      cta: root.querySelector('[data-submit]'),
      outHour: root.querySelector('[data-output="sumHour"]'),
      outMonth: root.querySelector('[data-output="sumMonth"]'),
    };

    state.allData = await TraktorRepository.getAll();

    setupDropdownToggles();
    setupBrandButtons();
    setupSliders();
    setupExtras();
    setupCta();
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
    renderExtras(tractor);
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

  // ── Zusatzausstattung (datengetrieben aus tractor.extras) ─────────────
  // Delegierter Change-Listener: Checkboxen werden je Modell neu gerendert,
  // daher EINMAL am Container lauschen statt pro Checkbox neu zu binden.
  function setupExtras() {
    if (dom.extrasContainer) {
      dom.extrasContainer.addEventListener('change', recalc);
    }
  }

  // HTML-Escape für Attributwerte (label/key); Infotext ist bewusst HTML (RichText).
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Checkboxen für das gewählte Modell aufbauen. Serienmäßige Extras sind
  // vorausgewählt + gesperrt (Aufschlag immer im Preis); optionale frei wählbar.
  function renderExtras(tractor) {
    const c = dom.extrasContainer;
    if (!c) return;
    const extras = Array.isArray(tractor.extras) ? tractor.extras : [];

    if (dom.extrasSection) dom.extrasSection.style.display = extras.length ? '' : 'none';

    c.innerHTML = extras.map((ex) => {
      const serie = !!ex.serie;
      const preis = Number(ex.preis) || 0;
      return (
        '<label class="calc__checkbox-label' + (serie ? ' calc__checkbox-label--serie' : '') + '"'
          + (serie ? ' title="serienmäßig enthalten"' : '') + '>'
        + '<input type="checkbox" class="calc__checkbox-input" data-extra-key="' + escAttr(ex.key) + '"'
          + ' data-preis="' + preis + '"' + (serie ? ' checked disabled' : '') + '>'
        + '<span class="calc__checkbox-box"></span>'
        + escAttr(ex.label)
        + (ex.info
            ? '<span class="calc__info-tip">i<span class="calc__tooltip">' + ex.info + '</span></span>'
            : '')
        + '</label>'
      );
    }).join('');
  }

  // Summe der €/h-Aufschläge: alle angehakten Checkboxen (serienmäßige sind
  // immer checked+disabled und damit automatisch enthalten).
  function extrasAufschlag() {
    if (!dom.extrasContainer) return 0;
    let sum = 0;
    dom.extrasContainer.querySelectorAll('.calc__checkbox-input').forEach((cb) => {
      if (cb.checked) sum += Number(cb.getAttribute('data-preis')) || 0;
    });
    return sum;
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
      zusatzAufschlag: extrasAufschlag(),
      selbstbehaltIndex: state.selbstbehaltIndex,
    });

    if (!result) return;
    // Nur die reine Zahl in den <span data-output> schreiben — der umgebende
    // Text (z. B. "nur … € / Betriebsstunde") bleibt frei im HTML editierbar.
    if (dom.outHour) dom.outHour.textContent = eur.format(result.sumHour);
    if (dom.outMonth) dom.outMonth.textContent = eur.format(result.sumMonth);
  }

  // ── Angebot anfordern → vorbefülltes Typeform in neuem Tab ────────────
  function setupCta() {
    if (!dom.cta) return;
    dom.cta.addEventListener('click', openTypeform);
  }

  // Baut das Hidden-Field-Objekt (Typeform „Variables") aus dem aktuellen Zustand.
  function buildHiddenFields() {
    const tractor = state.allData[state.model] || {};
    const hidden = {
      miete_modell: tractor.label || state.model || '',
      miete_betriebsstunden: String(state.stundenTiers[state.stundenIndex] || ''),
      miete_start: monthLabel(state.startIndex),
      miete_ende: monthLabel(state.endIndex),
      miete_selbstbehalt: SELBSTBEHALT[state.selbstbehaltIndex] + ' EUR',
      mietpreis_probetriebsstunde: dom.outHour ? dom.outHour.textContent : '',
      mietpreis_promonat: dom.outMonth ? dom.outMonth.textContent : '',
    };

    // Nur tatsächlich angehakte Extras (Serie ist immer checked) → Slots 1–4.
    // Serienausstattung bekommt den Zusatz "(Serienausstattung)".
    const selected = [];
    if (dom.extrasContainer) {
      dom.extrasContainer.querySelectorAll('.calc__checkbox-input').forEach((cb) => {
        if (!cb.checked) return;
        const ex = (tractor.extras || []).find((e) => e.key === cb.getAttribute('data-extra-key'));
        if (ex) selected.push(ex.label + (ex.serie ? ' (Serienausstattung)' : ''));
      });
    }
    for (let i = 0; i < 4; i++) {
      hidden['miete_zustatzausstattung_' + (i + 1)] = selected[i] || '';
    }
    return hidden;
  }

  // Öffnet das Typeform-Angebotsformular als On-Page-Popup: eigenes Modal-Overlay
  // mit einem ROHEN <iframe> auf die Standalone-URL, die aktuelle Konfiguration
  // als vorbefüllte URL-Parameter (Hidden Fields).
  //
  // WICHTIG — bewusst NICHT Typeforms Embed-SDK (window.tf/createPopup bzw.
  // data-tf-popup): dessen Popup-iframe lädt im Drittanbieter-Kontext NICHT durch
  // (Spinner hängt dauerhaft, "Failed to fetch" beim Tracking-Call
  // TRACK_FORM_VIEW_OPEN) — live auf Desktop UND Handy reproduziert, bei JS-API
  // und data-tf-popup gleichermaßen. Ein rohes iframe OHNE die SDK-eigenen
  // typeform-embed-Parameter rendert dagegen zuverlässig (live verifiziert).
  // Darum eigenes Modal + plain <iframe>. embed.js wird nicht mehr benötigt.
  function openTypeform() {
    const hidden = buildHiddenFields();
    const qs = Object.keys(hidden)
      .filter((k) => hidden[k] !== '' && hidden[k] != null)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(hidden[k]))
      .join('&');
    // Werte ins #-Fragment hängen — so liest Typeform die URL-Parameter
    // (früher „Hidden Fields"); ?query funktioniert dafür NICHT zuverlässig.
    openFormModal('https://form.typeform.com/to/' + TYPEFORM_ID + '#' + qs);
  }

  // Styles fürs Modal liegen in konfigurator.css (.et-tf-overlay/.et-tf-modal/
  // .et-tf-frame/.et-tf-close) — dort die Höhe etc. anpassen.
  let modalKeyHandler = null;
  function openFormModal(url) {
    closeFormModal();          // evtl. offenes Modal zuerst schließen (idempotent)

    const overlay = document.createElement('div');
    overlay.className = 'et-tf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'et-tf-modal';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'et-tf-close';
    close.setAttribute('aria-label', 'Schließen');
    close.innerHTML = '&times;';

    const frame = document.createElement('iframe');
    frame.className = 'et-tf-frame';
    frame.title = 'Angebot anfordern';
    frame.src = url;

    modal.appendChild(close);
    modal.appendChild(frame);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';   // Hintergrund-Scroll sperren

    close.addEventListener('click', closeFormModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFormModal(); });
    modalKeyHandler = (e) => { if (e.key === 'Escape') closeFormModal(); };
    document.addEventListener('keydown', modalKeyHandler);
  }

  function closeFormModal() {
    const overlay = document.querySelector('.et-tf-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    if (modalKeyHandler) {
      document.removeEventListener('keydown', modalKeyHandler);
      modalKeyHandler = null;
    }
  }
})();
