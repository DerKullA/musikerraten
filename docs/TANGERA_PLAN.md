# Tangera – Game-Development-Plan

Trinkspiel mit einem Skatblatt (36 Karten: 6 bis Ass in vier Farben). Die Karten werden einzeln aufgedeckt, jeder Kartenwert löst ein eigenes Ereignis aus. Gespielt wird auf einem Gerät, das reihum geht oder in der Mitte liegt.

## 1. Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Spotify | Tangera braucht kein Spotify. Es startet direkt aus dem Login-Bildschirm („Ohne Spotify spielen“) und ist zusätzlich im Hauptmenü. |
| Spieler | 2 bis 12 Namen vorab. Die App zeigt, wer dran ist, und merkt sich Quizmaster, Bitch, Regeln und Schlücke. |
| Verlierer („der Letzte verliert“) | Die Gruppe tippt den Verlierer in der Spielerliste an. Die App zählt die Schlücke mit. |
| Inhalte | Deutsche Inhalte in einer Datei (`logic/content.ts`). Ein Spicy-/18+-Schalter im Setup fügt härtere Fragen, Aufgaben und Kategorien hinzu. |

## 2. Festlegungen und Annahmen

Von dir bestätigt:

1. **„Runde“ = das ganze Spiel.** Quizmaster und Bitch bleiben, bis der Stapel leer ist oder ein anderer Spieler die gleiche Karte zieht.
2. **Bitch**: Die Gruppe ruft laut „Bitch 1“ bis „Bitch 5“, die App zählt nichts mit. Sie zeigt nur einen Hinweis vor jedem Zug der Bitch.
3. **Bestrafungen sind immer 1 Schluck** (Verlierer bei Sieben Tod, Kasper, Kategorie; Verweigern bei Wahrheit oder Pflicht). Die 10 (10 Schlücke) und der Wasserfall-Shot bleiben, wie in der Vorlage beschrieben.
4. **Kein „+1 Schluck“-Knopf.** Quizmaster-Verstöße und Regelbrüche regelt die Gruppe.

Weitere Annahmen:

5. **10er-Karte**: Herz und Karo (rot) verteilt man 10 Schlücke auf die anderen. Pik und Kreuz (schwarz) trinkt man alle 10 selbst.
6. **Wasserfall**: Wer zu früh absetzt (Glas nicht leer, nicht der Ass-Zieher), trinkt einen Shot. Shots werden getrennt gezählt.
7. **Spielende** ist, wenn die 36. Karte abgehandelt wurde. Die Auswertung zählt nur, was die App entscheidet (Verlierer, 10er, Wasserfall-Shots).

## 3. Spielablauf

```
Setup (Namen, Spicy)  →  Zug: „Name ist dran“  →  Karte aufdecken  →  Ereignis  →  nächster Spieler
                              ↑                                                        │
                              └── (Bitch-Zug: erst Bitch-Rufe) ←───────────────────────┘
                                                                  Stapel leer → Auswertung
```

### Kartenereignisse

| Karte | Ereignis | Ablauf in der App |
| --- | --- | --- |
| 6 | Wahrheit oder Pflicht | Münze werfen (zufällig Wahrheit/Pflicht), dann Glücksrad mit 8 Titeln, das Ergebnis zeigt die Frage bzw. Aufgabe. |
| 7 | Sieben Tod | Alle zählen reihum von 1. Zahlen mit 7 oder durch 7 teilbar heißen „Piep“. Optionale Schiedsrichter-Hilfe zeigt die Zahl. Verlierer wählen (1 Schluck). |
| 8 | Quizmaster | Der Spieler wird Quizmaster. Der alte verliert die Rolle. |
| 9 | Regel | Neue Regel schreiben (mit Ideen-Knopf) oder eine bestehende aufheben. |
| 10 | Trinken oder selber trinken | Rot: 10 Schlücke verteilen. Schwarz: 10 Schlücke selbst trinken. |
| Bube | Der Kasper | 2× Oberschenkel, 2× klatschen, 2× Wangen. Der Letzte verliert, Verlierer wählen. |
| Dame | Die Bitch | Der Spieler wird Bitch. Vor jedem seiner nächsten Züge ruft die Gruppe laut „Bitch 1“ bis „Bitch 5“ (Hinweis in der App). |
| König | Kategorie | Glücksrad mit Kategorien. Reihum nennen, wer nichts weiß, doppelt nennt oder falsch liegt, trinkt. Verlierer wählen. |
| Ass | Wasserfall | Alle trinken gleichzeitig, bis der Ass-Zieher aufhört. Wer zu früh absetzt, trinkt einen Shot. |

## 4. Architektur

Tangera ist ein Registry-Spiel wie Shotless (siehe README, „Neues Spiel hinzufügen“).

```
src/games/tangera/
  TangeraScreen.tsx        # Setup ↔ Tisch ↔ Auswertung
  tangera.css              # Klassen mit Präfix tangera-
  components/              # Setup, Tisch, Karte, Münze, Glücksrad, Spielerwahl, Ereignisse
  hooks/                   # useTangeraLobby (Setup + Speicherung), useTangeraGame (Reducer)
  logic/                   # reine, getestete Funktionen
    cards.ts               # Deck, Mischen, Farben, Bezeichnungen
    game.ts                # Zustand und Reducer (draw, resolve, apply)
    sevenDeath.ts          # „Piep“-Regel
    wheel.ts               # Segmentwahl und Drehwinkel
    players.ts             # Namen hinzufügen/entfernen
    session.ts             # Namen und Spicy im Browser merken
    content.ts             # Fragen, Aufgaben, Kategorien, Regel-Ideen
```

**Änderungen an der Shell** (klein gehalten):

- `GameModule.requiresSpotify` (Standard `true`). Tangera setzt `false`.
- `useNavigation`: `signedIn`-Zustand, `playStandalone(id)`, Zurück führt ohne Login zum Login-Bildschirm, nicht ins Hauptmenü.
- `LoginScreen`: zusätzlicher Knopf „Tangera ohne Spotify spielen“.
- `App.tsx`: beendet die Wiedergabe nur bei Spielen mit Spotify.

**Zustandsmodell** (`logic/game.ts`): `phase` ∈ `turn | bitch | event | finished`. Die Ereignis-Komponenten halten ihren Animationszustand (Münze, Rad, Eingaben) lokal und melden am Ende nur das Ergebnis als `Effects` (`sips`, `shots`, `addRule`, `removeRule`) an den Reducer. Rollen (Quizmaster, Bitch) setzt der Reducer direkt beim Ziehen.

## 5. Meilensteine

| # | Meilenstein | Inhalt | Status |
| --- | --- | --- | --- |
| M0 | Plan und Fragen | Dieses Dokument | erledigt |
| M1 | Logik | Deck, Reducer, Sieben-Tod, Rad-Mathematik, Namen, Session. Alles mit Vitest. | v1 |
| M2 | Shell | Registry-Eintrag, Login ohne Spotify, Navigation | v1 |
| M3 | UI-Gerüst | Setup, Tisch, Kartenflip, Statusleiste, Auswertung | v1 |
| M4 | Ereignisse | Alle neun Karten inklusive Münze und Glücksrad | v1 |
| M5 | Inhalte | Fragen, Aufgaben, Kategorien, Regel-Ideen, Spicy | v1 |
| M6 | Feinschliff | Vibration, Reduced-Motion, Bedienung am Handy | v1 |
| M7 | Ideen für v1.1 | Einstellbare Strafschlücke, eigene Inhalte im Setup, Sounds, „Runde“ = Durchgang, Spielstand fortsetzen, Reaktions-Buzzer für Kasper | offen |

## 6. Tests und Abnahme

- **Vitest** (reine Logik): Deck hat 36 Karten, je vier pro Wert, je Farbe neun. Reducer: Ziehen, Rollenwechsel, Bitch-Zug, Spielende, Effekte. Sieben Tod: 7, 14, 17, 27, 70 sind „Piep“. Rad: jeder Index und jeder Versatz landet unter dem Zeiger. Namen: Grenzen und Duplikate. Inhalte: genug Einträge für ein 8er-Rad, keine doppelten Titel.
- **Browser** (Dev-Server): Alle neun Ereignisse einmal durchspielen, schmales Handy-Fenster prüfen, Konsole ohne Fehler.
- **Gate**: `npm test`, `npm run lint`, `npm run build` müssen grün sein.
