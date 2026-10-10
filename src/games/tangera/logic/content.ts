/** Inhalte für Wahrheit oder Pflicht, Kategorien und Regel-Ideen. `spicy` gilt nur im 18+-Modus. */

export interface WheelCard {
  /** Kurzer Titel, der im Rad steht (höchstens ca. 18 Zeichen). */
  title: string
  /** Vollständige Frage bzw. Aufgabe. */
  text: string
  spicy?: boolean
}

export interface Category {
  name: string
  spicy?: boolean
}

export const TRUTHS: readonly WheelCard[] = [
  { title: 'Peinlichster Moment', text: 'Was war dein peinlichster Moment in der Öffentlichkeit?' },
  { title: 'Größte Lüge', text: 'Welche ist die größte Lüge, die du je erzählt hast?' },
  { title: 'Heimlicher Schwarm', text: 'In wen warst du schon mal heimlich verliebt, ohne dass die Person es wusste?' },
  { title: 'Guilty Pleasure', text: 'Welches Lied, welche Serie oder welcher Film ist dein größtes Guilty Pleasure?' },
  { title: 'Betrunken', text: 'Was war das Dümmste, was du je betrunken getan hast?' },
  { title: 'Falsche Nachricht', text: 'Hast du schon mal eine Nachricht an die falsche Person geschickt? Was stand drin?' },
  { title: 'Geheimes Talent', text: 'Welches Talent hast du, von dem fast niemand hier weiß?' },
  { title: 'Schlimmstes Date', text: 'Erzähle von deinem schlimmsten Date.' },
  { title: 'Letzte Suche', text: 'Was hast du zuletzt gegoogelt, das du ungern zeigen würdest?' },
  { title: 'Gestohlen', text: 'Was hast du schon mal mitgehen lassen, auch wenn es nur eine Kleinigkeit war?' },
  { title: 'Peinliche App', text: 'Welche App auf deinem Handy ist dir am peinlichsten?' },
  { title: 'Krank gemacht', text: 'Wann hast du zuletzt krankgemacht, obwohl du gesund warst?' },
  { title: 'Neid', text: 'Auf wen in der Runde bist du ein kleines bisschen neidisch und warum?' },
  { title: 'Einsame Insel', text: 'Wen aus der Runde würdest du auf eine einsame Insel mitnehmen und wen nicht?' },
  { title: 'Zombie-Apokalypse', text: 'Wer in der Runde würde die Zombie-Apokalypse als Erstes nicht überleben?' },
  { title: 'Dümmste Ausrede', text: 'Was war deine dümmste Ausrede, die tatsächlich funktioniert hat?' },
  { title: 'Spitzname', text: 'Welchen peinlichen Spitznamen hattest du früher?' },
  { title: 'Bereuen', text: 'Was bereust du am meisten?' },
  { title: 'Unbeliebte Meinung', text: 'Welche unbeliebte Meinung vertrittst du, bei der dir alle widersprechen würden?' },
  { title: 'Kindheit', text: 'Was war das Peinlichste, das dir als Kind passiert ist?' },
  { title: 'Rot geworden', text: 'Wann bist du zuletzt vor Peinlichkeit rot geworden?' },
  { title: 'Bester Streich', text: 'Welchen Streich hast du jemandem schon mal gespielt?' },
  { title: 'Sprachnachricht', text: 'Welche Sprachnachricht hast du schon mal bereut abgeschickt zu haben?' },
  { title: 'Eifersucht', text: 'Wann warst du das letzte Mal richtig eifersüchtig?' },
  { title: 'Alter Chat', text: 'Lies die peinlichste Nachricht aus deinem Chatverlauf vor oder trinke 1 Schluck.' },
  { title: 'Schlimmster Job', text: 'Was war dein schlimmster Job oder deine schlimmste Prüfung?' },
  { title: 'Tabu-Thema', text: 'Über welches Thema sprichst du nie mit deinen Eltern?' },
  { title: 'Wen mögen', text: 'Welche Person in der Runde hat dich beim ersten Treffen am meisten überrascht?' },
  { title: 'Erster Kuss', text: 'Wie alt warst du bei deinem ersten Kuss, und wie war er?', spicy: true },
  { title: 'Schwarm hier', text: 'Wen aus dieser Runde würdest du am ehesten küssen?', spicy: true },
  { title: 'Flirtspruch', text: 'Was war dein dreistester Flirtspruch, und hat er funktioniert?', spicy: true },
  { title: 'Nacktbaden', text: 'Warst du schon mal nackt baden? Wo und mit wem?', spicy: true },
  { title: 'Vergebener Schwarm', text: 'Hast du schon mal für jemanden geschwärmt, der vergeben war?', spicy: true },
  { title: 'Bett-Panne', text: 'Was war dein peinlichstes Erlebnis im Bett?', spicy: true },
  { title: 'Fantasie', text: 'Hast du eine Fantasie, die du noch niemandem erzählt hast? Eine Andeutung reicht.', spicy: true },
  { title: 'Nachts an den Ex', text: 'Hast du schon mal nachts deinem Ex geschrieben?', spicy: true },
  { title: 'Dating-Apps', text: 'Welche Dating-Apps hast du ausprobiert, und was war das Schrägste?', spicy: true },
  { title: 'Knutschzahl', text: 'Mit wie vielen Menschen hast du schon geknutscht? Schätze ehrlich.', spicy: true },
  { title: 'Aufzug', text: 'Mit wem in der Runde würdest du am liebsten im Aufzug feststecken?', spicy: true },
  { title: 'Traumpartner', text: 'Welcher Promi wäre dein Traumpartner für eine Nacht?', spicy: true },
]

export const DARES: readonly WheelCard[] = [
  { title: 'Tierimitation', text: 'Imitiere ein Tier deiner Wahl, bis die Gruppe es errät.' },
  { title: 'Tanzeinlage', text: 'Tanze 20 Sekunden ohne Musik, als würde dich keiner sehen.' },
  { title: 'Planke', text: 'Halte 30 Sekunden die Planke oder trinke 1 Schluck.' },
  { title: 'Dialekt', text: 'Sprich in den nächsten zwei Zügen nur im Dialekt deiner Wahl.' },
  { title: 'Refrain', text: 'Singe den Refrain eines Liedes, das die Gruppe aussucht.' },
  { title: 'Hässliches Selfie', text: 'Mache das hässlichste Selfie, das du kannst, und zeige es der Runde.' },
  { title: 'Alphabet rückwärts', text: 'Sage das Alphabet rückwärts ab Z. Bei einem Fehler trinkst du 1 Schluck.' },
  { title: 'Lobrede', text: 'Halte eine 30-sekündige Lobrede auf einen Gegenstand im Raum.' },
  { title: 'Roboter', text: 'Sei bis zu deinem nächsten Zug ein Roboter: Sprich und bewege dich wie einer.' },
  { title: 'Andere Hand', text: 'Trinke bis zu deinem nächsten Zug nur mit der Hand, die du sonst nicht benutzt.' },
  { title: 'Massage', text: 'Gib der Person links neben dir 20 Sekunden lang eine Schultermassage.' },
  { title: 'Werbespot', text: 'Mache Werbung für das Glas in deiner Hand, als wäre es das beste Produkt der Welt.' },
  { title: 'Zungenbrecher', text: 'Sage dreimal schnell: „Fischers Fritz fischt frische Fische“. Bei einem Fehler trinkst du 1 Schluck.' },
  { title: 'Komplimente', text: 'Mache jeder Person in der Runde ein ehrliches Kompliment.' },
  { title: 'Pantomime', text: 'Stelle einen Filmtitel pantomimisch dar, bis die Gruppe ihn errät.' },
  { title: 'Siegerrede', text: 'Steige auf einen Stuhl und halte eine Siegerrede, als hättest du den Oscar gewonnen.' },
  { title: 'Fantasiesprache', text: 'Erkläre in einer erfundenen Sprache, wie man ein Bier einschenkt.' },
  { title: 'Blickkontakt', text: 'Halte 20 Sekunden Blickkontakt mit einer Person deiner Wahl, ohne zu lachen.' },
  { title: 'Nachrichtensprecher', text: 'Lies die Uhrzeit wie ein Nachrichtensprecher vor, bei dem etwas Schlimmes passiert ist.' },
  { title: 'Liegestütze', text: 'Mache 10 Liegestütze oder trinke 1 Schluck.' },
  { title: 'Spiegel', text: 'Eine Person deiner Wahl spiegelt 30 Sekunden lang jede deiner Bewegungen.' },
  { title: 'Neuer Spitzname', text: 'Gib der Person rechts neben dir einen Spitznamen, der bis zum Spielende gilt.' },
  { title: 'Schuhtausch', text: 'Tausche einen Schuh mit jemandem und trage ihn bis zum Spielende.' },
  { title: 'Zwei Wahrheiten', text: 'Erzähle drei Dinge über dich, davon ist eines gelogen. Die Gruppe rät, welches.' },
  { title: 'Opernstimme', text: 'Singe deinen Namen in Opernstimme.' },
  { title: 'Telefonjoker', text: 'Rufe jemanden an und frage ohne Erklärung: „Wie spät ist es auf dem Mond?“' },
  { title: 'Eiswürfel', text: 'Halte einen Eiswürfel, bis er geschmolzen ist, oder trinke 1 Schluck.' },
  { title: 'Standup', text: 'Erzähle einen Witz. Lacht keiner, trinkst du 1 Schluck.' },
  { title: 'Flirten', text: 'Flirte 20 Sekunden lang mit einer Person deiner Wahl.', spicy: true },
  { title: 'Handkuss', text: 'Gib der Person rechts neben dir einen Handkuss.', spicy: true },
  { title: 'Anmachspruch', text: 'Bringe die Person links von dir mit einem Anmachspruch zum Lachen.', spicy: true },
  { title: 'Sexy Tanz', text: 'Tanze 15 Sekunden lang so verführerisch du kannst.', spicy: true },
  { title: 'Verführerische Stimme', text: 'Lies die Zutatenliste einer Verpackung mit deiner verführerischsten Stimme vor.', spicy: true },
  { title: 'Liebesgedicht', text: 'Dichte ein Liebesgedicht mit zwei Zeilen für die Person gegenüber.', spicy: true },
  { title: 'Schlafzimmerblick', text: 'Setze deinen verführerischsten Blick auf, bis die Gruppe applaudiert.', spicy: true },
  { title: 'Charme-Offensive', text: 'Mache der Person gegenüber das charmanteste Kompliment, das dir einfällt.', spicy: true },
  { title: 'Kleidungstausch', text: 'Tausche ein Kleidungsstück (Jacke, Mütze, Socke) mit einer Person deiner Wahl.', spicy: true },
  { title: 'Wangenkuss', text: 'Gib einer Person deiner Wahl einen Kuss auf die Wange.', spicy: true },
  { title: 'Massage-Duell', text: 'Gib der Person gegenüber eine 15-sekündige Handmassage.', spicy: true },
  { title: 'Kuss-Wette', text: 'Die Gruppe sagt, wen du für 5 Sekunden fest umarmen musst.', spicy: true },
]

export const CATEGORIES: readonly Category[] = [
  { name: 'Automarken' },
  { name: 'Biermarken' },
  { name: 'Fußballvereine' },
  { name: 'Hauptstädte' },
  { name: 'Cocktails' },
  { name: 'Spirituosen' },
  { name: 'Süßigkeiten' },
  { name: 'Supermärkte' },
  { name: 'Käsesorten' },
  { name: 'Pizzabeläge' },
  { name: 'Disney-Filme' },
  { name: 'Bands' },
  { name: 'Fast-Food-Ketten' },
  { name: 'Obstsorten' },
  { name: 'Bundesländer' },
  { name: 'Zootiere' },
  { name: 'Superhelden' },
  { name: 'Sportarten' },
  { name: 'Netflix-Serien' },
  { name: 'Deutsche Städte' },
  { name: 'Berufe' },
  { name: 'Gewürze' },
  { name: 'Dinge im Badezimmer' },
  { name: 'Handymarken' },
  { name: 'Dinge im Schlafzimmer', spicy: true },
  { name: 'Dating-Apps', spicy: true },
  { name: 'Kosenamen', spicy: true },
  { name: 'Berühmte Liebespaare', spicy: true },
  { name: 'Orte zum Knutschen', spicy: true },
  { name: 'Flirtsprüche', spicy: true },
]

/** Anregungen für die 9, wenn jemand eine Regel erfinden will. */
export const RULE_IDEAS: readonly string[] = [
  'Wer „trinken“ sagt, trinkt selbst einen Schluck.',
  'Niemand sagt Namen. Alle sagen nur „du“.',
  'Beim Anstoßen muss man sich in die Augen sehen.',
  'Wer das Handy anfasst, trinkt einen Schluck.',
  'Getrunken wird nur mit der linken Hand.',
  'Wer lacht, trinkt einen Schluck.',
  'Wer aufs Klo will, trinkt vorher einen Schluck.',
  'Fluchen kostet einen Schluck.',
  'Vor jedem Schluck sagt man „Prost“ in einer anderen Sprache.',
  'Niemand zeigt mit dem Finger. Wer es tut, trinkt.',
  'Daumenregel: Wer den Daumen zuletzt auf den Tisch legt, trinkt.',
  'Jeder Satz endet mit „Alter“.',
  'Der Vorname des Nachbarn zur Linken darf nicht gesagt werden.',
  'Wer sein Glas abstellt, ohne zu trinken, trinkt einen Schluck.',
]

/** Pool je nach Spicy-Schalter: ohne Spicy nur die normalen Einträge. */
export function contentPool<T extends { spicy?: boolean }>(items: readonly T[], spicy: boolean): T[] {
  return items.filter((item) => spicy || !item.spicy)
}
