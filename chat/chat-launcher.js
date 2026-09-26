/*!
 * easyTraktor Chat-Assistent — Einbettung
 * =======================================
 * Eine Datei für alles: Chat-Button, Chat-Fenster und die Chat-Oberfläche.
 * In Webflow nur einmal im Footer-Code der Website einbinden:
 *   <script src="…/dist/easytraktor-chat.js" defer></script>
 *
 * Quelle: /chat — NICHT in dist/ editieren, sondern in chat/ ändern und bauen:
 *   node build.js
 *
 * Enthält die Schrift Manrope (eingebettet, kein externer Abruf):
 *   Copyright 2018 The Manrope Project Authors (https://github.com/sharanda/manrope)
 *   SIL Open Font License 1.1 — https://openfontlicense.org
 */
(function () {
  'use strict';

  // Nur einmal pro Seite, auch wenn das Skript versehentlich doppelt eingebunden ist
  if (window.__etChatGeladen) return;
  window.__etChatGeladen = true;

  // Die komplette Chat-Oberfläche (chat/chat-app.html inkl. eingebetteter
  // Schrift) — wird beim Build hier als String eingesetzt.
  var APP_HTML = /*__CHAT_APP_HTML__*/'';

  var MOBIL = '(max-width: 767px)';

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v10H7l-3 3V4z"/></svg>';
  var ICON_ZU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Alle Regeln hängen an den IDs des Chats — nichts wirkt auf die übrige Seite.
  var CSS = [
    '#et-chat-launcher{position:fixed;right:20px;bottom:20px;z-index:9999;width:56px;height:56px;margin:0;padding:0;',
    'border:0;border-radius:50%;background:#EE7500;color:#fff;display:grid;place-items:center;cursor:pointer;',
    'box-shadow:0 8px 24px rgba(0,0,0,.25);transition:background .15s ease,transform .15s ease;',
    '-webkit-tap-highlight-color:transparent}',
    '#et-chat-launcher:hover{background:#d46800;transform:translateY(-1px)}',
    '#et-chat-launcher:focus-visible{outline:3px solid rgba(238,117,0,.5);outline-offset:3px}',
    '#et-chat-launcher svg{display:block;width:22px;height:22px}',
    '#et-chat-panel{position:fixed;right:20px;bottom:86px;z-index:9999;',
    'width:min(620px,calc(100vw - 40px));height:min(70vh,720px);',
    'border-radius:16px;overflow:hidden;background:#0b0d10;box-shadow:0 20px 60px rgba(0,0,0,.35)}',
    '#et-chat-panel[hidden]{display:none}',
    '#et-chat-panel iframe{display:block;width:100%;height:100%;border:0;margin:0}',
    // Die schwebende Kontaktleiste der Website (Mail/Telefon, rechts) liegt auf
    // der höchsten Ebene und hat einen unsichtbaren, 250 px breiten Kasten — sie
    // würde am Desktop über dem Chat liegen und dort Klicks/Scrollen abfangen.
    // Solange der Chat offen ist, wird sie ausgeblendet. Gibt es die Klasse
    // nicht (mehr), passiert einfach nichts.
    'html.et-chat-offen .navigation-right.mobile-none{visibility:hidden}',
    // Handy: Vollbild. Der Button verschwindet (Schließen sitzt im Chat-Kopf),
    // die Seite dahinter scrollt nicht mit.
    '@media ' + MOBIL + '{',
    '#et-chat-panel{top:0;left:0;right:0;bottom:auto;width:100%;height:100%;height:100dvh;border-radius:0;box-shadow:none}',
    'html.et-chat-offen #et-chat-launcher{display:none}',
    'html.et-chat-offen,html.et-chat-offen body{overflow:hidden}',
    '}'
  ].join('');

  var btn, panel, frame, bereit = false, offen = false;
  var mobil = window.matchMedia ? window.matchMedia(MOBIL) : { matches: false };

  function init() {
    if (document.getElementById('et-chat-launcher')) return;

    var style = document.createElement('style');
    style.id = 'et-chat-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'et-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'EasyTraktor Assistent');
    panel.hidden = true;

    btn = document.createElement('button');
    btn.id = 'et-chat-launcher';
    btn.type = 'button';
    btn.setAttribute('aria-controls', 'et-chat-panel');
    zeigeButton(false);
    btn.addEventListener('click', function () { offen ? schliessen() : oeffnen(); });

    document.body.appendChild(panel);
    document.body.appendChild(btn);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && offen) schliessen();
    });

    // Handy: Fensterhöhe an den sichtbaren Bereich anpassen, damit das
    // Eingabefeld bei offener Bildschirmtastatur nicht verdeckt wird.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', passeHoeheAn);
      window.visualViewport.addEventListener('scroll', passeHoeheAn);
    }
    if (mobil.addEventListener) mobil.addEventListener('change', passeHoeheAn);
  }

  // Beschriftung + Symbol des Buttons. Kein versteckter Text im Button — das
  // alte „sr-only" gab es auf der Website nicht, der Text wäre sichtbar gewesen.
  function zeigeButton(istOffen) {
    var text = istOffen ? 'Chat schließen' : 'Chat öffnen';
    btn.setAttribute('aria-label', text);
    btn.setAttribute('title', text);
    btn.setAttribute('aria-expanded', istOffen ? 'true' : 'false');
    btn.innerHTML = istOffen ? ICON_ZU : ICON_CHAT;
  }

  // Die Chat-Oberfläche wird erst beim ersten Öffnen erzeugt: Wer den Chat nicht
  // nutzt, lädt nichts davon, und bis zum Klick gibt es keinerlei Verbindung
  // zum Chat-Dienst.
  function oeffnen() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'EasyTraktor Assistent';
      frame.addEventListener('load', verbinden);
      frame.srcdoc = APP_HTML;
      panel.appendChild(frame);
    }
    offen = true;
    panel.hidden = false;
    document.documentElement.classList.add('et-chat-offen');
    zeigeButton(true);
    passeHoeheAn();
    if (bereit) fokussieren();
  }

  function schliessen() {
    offen = false;
    panel.hidden = true;
    document.documentElement.classList.remove('et-chat-offen');
    zeigeButton(false);
    passeHoeheAn();
    try { btn.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  // Die Chat-Oberfläche meldet sich über window.etChatHost zum Schließen
  // (Schließen-Button im Kopf, ESC im Chat) und nimmt etChatFocus() entgegen.
  function verbinden() {
    bereit = true;
    try { frame.contentWindow.etChatHost = { close: schliessen }; } catch (e) { /* egal */ }
    if (offen) fokussieren();
  }

  // Am Rechner direkt ins Eingabefeld; auf Touch-Geräten nicht, sonst springt
  // sofort die Bildschirmtastatur auf und verdeckt den Chat.
  function fokussieren() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    try { frame.contentWindow.etChatFocus && frame.contentWindow.etChatFocus(); } catch (e) { /* egal */ }
  }

  function passeHoeheAn() {
    var vv = window.visualViewport;
    if (offen && mobil.matches && vv) {
      panel.style.height = vv.height + 'px';
      panel.style.top = vv.offsetTop + 'px';
    } else {
      panel.style.height = '';
      panel.style.top = '';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
