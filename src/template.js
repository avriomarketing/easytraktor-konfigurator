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
