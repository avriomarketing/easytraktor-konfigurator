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
    hersteller: {},     // Record<herstellerName, { name, aktiv, logo }>
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
    state.hersteller = TraktorRepository.getHersteller
      ? await TraktorRepository.getHersteller()
      : {};

    setupDropdownToggles();
    setupBrandButtons();
    setupSliders();
    setupExtras();
    setupCta();
    renderDateDropdowns();

    // Gesperrte Marken (Hersteller „Aktiv" = aus) ausgrauen + nicht klickbar
    applyBrandAvailability();

    // Erstauswahl: erste VERFÜGBARE Marke + erstes Modell
    pickInitialBrand();
    renderModelDropdown();
    selectFirstModel();

    recalc();
  }

  // ── Marken-Buttons (Filter) ───────────────────────────────────────────
  function setupBrandButtons() {
    dom.brands.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Gesperrte Marke (Hersteller „Aktiv" = aus) ist nicht wählbar
        if (btn.classList.contains('calc__manufacturer--gesperrt')) return;
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

  // Gesperrte Marken markieren: Hersteller mit „Aktiv" = aus bekommen die Klasse
  // --gesperrt (ausgegraut + nicht klickbar) und einen Hover-Tooltip.
  function isBrandGesperrt(name) {
    const h = state.hersteller[name];
    return !!(h && h.aktiv === false);
  }

  function applyBrandAvailability() {
    dom.brands.forEach((btn) => {
      const name = btn.getAttribute('data-brand');
      const gesperrt = isBrandGesperrt(name);
      btn.classList.toggle('calc__manufacturer--gesperrt', gesperrt);

      if (gesperrt && !btn._lockTip) {
        // Tooltip ans <body> hängen (NICHT in den Button), damit er nicht die
        // reduzierte Opacity des gesperrten Buttons erbt. Position + Anzeige per JS.
        const tip = document.createElement('span');
        tip.className = 'calc__tooltip calc__tooltip--brand';
        tip.textContent = 'Aktuell nicht verfügbar';
        tip.style.display = 'none';
        document.body.appendChild(tip);
        btn._lockTip = tip;

        const show = () => {
          const r = btn.getBoundingClientRect();
          tip.style.position = 'fixed';
          tip.style.top = (r.bottom + 10) + 'px';
          tip.style.left = (r.left + r.width / 2) + 'px';
          tip.style.bottom = 'auto';
          tip.style.transform = 'translateX(-50%)';
          tip.style.display = 'block';
        };
        const hide = () => { tip.style.display = 'none'; };
        btn.addEventListener('mouseenter', show);
        btn.addEventListener('mouseleave', hide);
      } else if (!gesperrt && btn._lockTip) {
        btn._lockTip.remove();
        btn._lockTip = null;
      }
    });
  }

  // Erste wählbare Marke aktiv setzen. Ist die vorab aktive Marke gesperrt,
  // springt die Auswahl auf den ersten nicht gesperrten Button.
  function pickInitialBrand() {
    let active = root.querySelector('.calc__manufacturer--active[data-brand]');
    if (!active || active.classList.contains('calc__manufacturer--gesperrt')) {
      let firstAvail = null;
      dom.brands.forEach((b) => {
        if (!firstAvail && !b.classList.contains('calc__manufacturer--gesperrt')) firstAvail = b;
      });
      if (firstAvail) {
        dom.brands.forEach((b) => {
          b.classList.remove('calc__manufacturer--active');
          b.classList.add('calc__manufacturer--inactive');
        });
        firstAvail.classList.add('calc__manufacturer--active');
        firstAvail.classList.remove('calc__manufacturer--inactive');
        active = firstAvail;
      }
    }
    state.brand = active ? active.getAttribute('data-brand') : null;
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
