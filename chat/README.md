# easyTraktor Chat-Assistent

Chat-Button unten rechts + Chat-Fenster für den EasyTraktor KI-Assistenten.
Übernommen vom TYPO3-Chat, überarbeitet und als **eine** JS-Datei ausgeliefert.

## Einbinden (Webflow)

Einmal in **Site Settings → Custom Code → Footer Code**:

```html
<script src="https://cdn.jsdelivr.net/gh/avriomarketing/easytraktor-konfigurator@chat-v1.0.0/dist/easytraktor-chat.js" defer></script>
```

Mehr braucht es nicht — Button, Fenster, Styles und Schrift kommen aus der Datei.

## Aufbau

| Datei | Inhalt |
|---|---|
| `chat-app.html` | die Chat-Oberfläche (läuft im iframe). Hier steht auch die `WEBHOOK_URL`. |
| `chat-launcher.js` | Button, Fenster, Öffnen/Schließen, mobiles Vollbild |
| `fonts/manrope-latin-wght.woff2` | Manrope (OFL), wird beim Build als Base64 eingebettet |

`node build.js` erzeugt `dist/easytraktor-chat.js` (und wie bisher den Konfigurator).
Nie in `dist/` editieren.

## Verhalten

- Beim Seitenaufruf wird nur der Button angelegt. Die Chat-Oberfläche entsteht erst
  beim ersten Klick — vorher keinerlei Verbindung zum Chat-Dienst.
- Keine externen Abrufe außer dem Chat-Dienst selbst (beim Senden). Die Schrift ist
  eingebettet, es gibt keinen Kontakt zu Google-Servern.
- Handy (bis 767 px): Vollbild, Schließen über das × im Chat-Kopf, die Seite dahinter
  scrollt nicht mit, das Fenster passt sich der Bildschirmtastatur an.
- Verlauf und Session liegen im localStorage unter `et-chat-verlauf`,
  `et-chat-session`, `et-chat-theme`. Die alten TYPO3-Schlüssel `et-chat` und
  `et-theme` werden beim ersten Öffnen entfernt.
- Solange der Chat offen ist, wird die schwebende Kontaktleiste der Website
  (`.navigation-right.mobile-none`) ausgeblendet. Sie läge sonst über dem Chat.

## Versionen

Eigene Tags mit Präfix `chat-` (unabhängig von den Konfigurator-Versionen `v2.x`):
`chat-v1.0.0`, `chat-v1.0.1`, … Rollback = Tag im Embed-Code zurücksetzen.
