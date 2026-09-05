# Control for RadioBOSS

Steuert [RadioBOSS](https://www.djsoft.net/) über dessen
[Remote Control API](https://manual.djsoft.net/radioboss/en/remote_controlapi.htm).
Aktuell enthalten: eine **Mikrofon**-Taste.

## RadioBOSS vorbereiten

In RadioBOSS unter **Settings ➝ Remote control**:

1. Remote Control API aktivieren.
2. Port merken (Standard: `9000`).
3. Ein Passwort setzen — ohne Passwort startet die API nicht.

Kurz gegenprüfen lässt sich das im Browser:

```bash
curl "http://127.0.0.1:9000/?pass=DEINPASSWORT&action=status"
```

## Installieren

```bash
npm install
npm run build
npx streamdeck link com.moritz-koschel.radioboss.sdPlugin
npx streamdeck restart com.moritz-koschel.radioboss
```

Danach liegt die Aktion in der Stream-Deck-App unter der Kategorie **RadioBOSS**.

## Einstellungen

Die Konfiguration ist nach dem
[Elgato-Settings-Modell](https://docs.elgato.com/streamdeck/sdk/guides/settings)
auf zwei Ebenen aufgeteilt.

**Global settings** — einmal gesetzt, gelten für jede RadioBOSS-Taste:

| Feld | Standard | Bedeutung |
| --- | --- | --- |
| Host | `127.0.0.1` | Rechner, auf dem RadioBOSS läuft |
| Port | `9000` | Port der Remote Control API |
| Benutzer | *(leer)* | optional, nur bei konfigurierten RemoteUsers |
| Passwort | — | das API-Passwort aus den RadioBOSS-Einstellungen |
| HTTPS | aus | nur mit einem Zertifikat, dem das System vertraut |
| Timeout | `4000` ms | Abbruch, wenn RadioBOSS nicht antwortet |

**Action settings** — pro Taste einstellbar:

| Feld | Standard | Bedeutung |
| --- | --- | --- |
| Bei Tastendruck | Umschalten | Umschalten, fest an, oder fest stumm |
| Status abfragen | 2 s | Poll-Intervall; `0` schaltet das Pollen ab, der Wert steht unter dem Regler |
| Beschriftung | aus | zeigt `LIVE` / `STUMM` auf der Taste |

Das Passwort landet in den Global settings, also in der Stream-Deck-Konfiguration —
nicht verschlüsselt. Das Log-Level steht deshalb auf `info` statt `trace`, damit
das Passwort nicht zusätzlich in den Plugin-Logs auftaucht.

## Was RadioBOSS nicht hergibt

Weder die Jingles-Leiste (Slots 1–0) noch die
[Cart wall](https://manual.djsoft.net/radioboss/en/cart_wall.htm) lassen sich
über die Remote Control API auslösen. In der gesamten
[Befehlsliste](https://manual.djsoft.net/radioboss/en/scheduler_commands.htm)
gibt es dafür kein Kommando, und die API-Doku kennt „cart" überhaupt nicht. Eine
Soundpad-Taste ist daher bewusst nicht Teil des Plugins.

## Verhalten

Die Taste hat zwei Zustände: **stumm** (graues, durchgestrichenes Mikrofon) und
**live** (rotes Mikrofon). Der Zustand kommt von RadioBOSS selbst, nicht aus einem
lokalen Zähler — wird das Mikrofon woanders geschaltet, zieht die Taste beim
nächsten Poll nach. Im Modus *Umschalten* wird der aktuelle Zustand direkt vor dem
Schalten abgefragt, damit ein Druck auch ohne Polling richtig umschaltet.

Schlägt eine Anfrage fehl, zeigt Stream Deck kurz ein Warndreieck; Details stehen
im Plugin-Log. Der Knopf *Verbindung testen* im Property Inspector prüft Adresse
und Passwort gegen `action=status`.

## Weitergeben

```bash
npm run pack
```

Baut neu und erzeugt `com.moritz-koschel.radioboss.streamDeckPlugin`. Die Datei
lässt sich per Doppelklick installieren — ohne Marketplace, ohne Konto. Für den
eigenen Rechner oder zum Weitergeben im Team reicht das.

`.sdignore` hält Laufzeit-Logs und Sourcemaps aus dem Paket heraus, und
`Nodejs.Debug` ist im Manifest nicht gesetzt, damit ausgelieferte Builds keinen
Debug-Port öffnen.

### Marketplace

Für eine Veröffentlichung über [Maker Console](https://maker.elgato.com) kommen
noch Assets dazu, die nicht im Paket stecken: ein Thumbnail (1920 × 960 px PNG)
und Gallery-Items (1920 × 960 px PNG oder 1920 × 1080 MP4). Die Icons im Paket
erfüllen bereits die
[Vorgaben](https://docs.elgato.com/guidelines/stream-deck/plugins/): Plugin-Icon
256 × 256 und 512 × 512, Kategorie-Icon 28 × 28 und 56 × 56, Action-Icon 20 × 20
und 40 × 40 — Kategorie- und Action-Icon monochrom weiß auf transparent.

Die `UUID` darf sich nach der ersten Veröffentlichung **nicht** mehr ändern.

## Sprache

Das Plugin ist zweisprachig. Stream Deck wählt anhand seiner eigenen
Spracheinstellung — auf einer deutschen Installation ist alles deutsch, sonst
englisch.

| Ort | Datei |
| --- | --- |
| Manifest (Name, Beschreibung, Aktion, States) | [de.json](com.moritz-koschel.radioboss.sdPlugin/de.json) |
| Texte aus dem Plugin-Code (`streamDeck.i18n.translate`) | `Localization`-Block in `en.json` / `de.json` |
| Property Inspector | [ui/i18n.js](com.moritz-koschel.radioboss.sdPlugin/ui/i18n.js) |

Englisch steht direkt im Manifest und ist der Fallback; `de.json` überschreibt
es. Der Property Inspector braucht einen eigenen Satz, weil sdpi-components ihre
Übersetzungen nicht selbst laden — `i18n.js` setzt `SDPIComponents.i18n.locales`,
bevor die Komponenten hochfahren. Labels und Optionen darin sind als
`__MSG_key__` geschrieben, alles andere trägt ein `data-i18n`-Attribut.

Eine weitere Sprache heißt: `xx.json` neben das Manifest legen und in `i18n.js`
einen Block ergänzen.

## Entwicklung

```bash
npm run link       # verlinkt den Projektordner in Stream Deck
npm run watch      # baut neu und startet das Plugin
npm run unlink     # entfernt es wieder aus Stream Deck
npm test           # Tests gegen einen nachgebauten RadioBOSS-Server
npm run typecheck  # tsc --noEmit
npm run icons      # erzeugt alle PNGs neu (tools/generate-icons.mjs)
```

Der verlinkte Entwicklungsstand und eine per Doppelklick installierte
`.streamDeckPlugin` schließen sich aus — gleiche UUID, es geht immer nur eins.
`npm run unlink` beendet das Plugin erst und räumt es dann weg; ohne das Stoppen
scheitert das Löschen an offenen Dateien. Das `--delete` darin entfernt auch eine
echte Installation, nicht nur den Link.

Deine Verbindungsdaten liegen in den Global settings von Stream Deck und
überstehen das Entfernen.

Die Icons werden aus Distanzfeldern gerendert und mit dem eingebauten `zlib`
kodiert; es gibt also keine Bild-Abhängigkeit im Build.

### Aufbau

| Datei | Zweck |
| --- | --- |
| [src/plugin.ts](src/plugin.ts) | Einstiegspunkt, registriert die Aktionen |
| [src/actions/mic.ts](src/actions/mic.ts) | die Mikrofon-Taste samt Poll-Timer |
| [src/property-inspector.ts](src/property-inspector.ts) | serverseitiger Teil des Property Inspector |
| [src/radioboss/client.ts](src/radioboss/client.ts) | HTTP-Client für die API |
| [src/radioboss/settings.ts](src/radioboss/settings.ts) | Settings-Typen und -Normalisierung |
| [src/radioboss/global-settings.ts](src/radioboss/global-settings.ts) | Zugriff auf die Global settings |
| [ui/mic.html](com.moritz-koschel.radioboss.sdPlugin/ui/mic.html) | Property Inspector |
| [ui/connection.js](com.moritz-koschel.radioboss.sdPlugin/ui/connection.js) | Verbindungstest im Property Inspector |
| [ui/i18n.js](com.moritz-koschel.radioboss.sdPlugin/ui/i18n.js) | Übersetzungen für den Property Inspector |

### Hinweis zur API-Antwort

Das Handbuch beschreibt `action=mic` ohne den Parameter `on` nur als „returns
microphone status“, ohne das Format festzulegen. `parseMicState` akzeptiert daher
mehrere plausible Formen (`<Mic on="1"/>`, `1`, `on`, `true` …). Meldet RadioBOSS
gar keinen Zustand, behält die Taste ihren letzten bekannten — sie springt nicht
auf „stumm“ zurück.
