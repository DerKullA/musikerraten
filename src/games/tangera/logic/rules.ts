import type { Rank } from './cards.ts'

/** Bestrafung: Der Verlierer einer Mini-Runde (Sieben Tod, Kasper, Kategorie) oder wer verweigert, trinkt einen Schluck. */
export const LOSER_SIPS = 1
/** Schlücke bei der 10: verteilen (rot) oder selbst trinken (schwarz). */
export const TEN_SIPS = 10
export const MAX_RULE_LENGTH = 120

export interface RankEvent {
  title: string
  summary: string
}

export const RANK_EVENTS: Record<Rank, RankEvent> = {
  '6': { title: 'Wahrheit oder Pflicht', summary: 'Die Münze entscheidet, das Glücksrad wählt Frage oder Aufgabe.' },
  '7': { title: 'Sieben Tod', summary: 'Reihum zählen. Zahlen mit 7 oder durch 7 teilbar heißen „Piep“.' },
  '8': { title: 'Quizmaster', summary: 'Wer die 8 zieht, ist Quizmaster. Seine Fragen darf niemand beantworten.' },
  '9': { title: 'Regel', summary: 'Eine neue Regel aufstellen oder eine bestehende aufheben.' },
  '10': { title: 'Trinken oder selber trinken', summary: 'Rot: 10 Schlücke verteilen. Schwarz: 10 Schlücke selbst trinken.' },
  B: { title: 'Der Kasper', summary: '2× Oberschenkel, 2× klatschen, 2× Wangen. Der Letzte verliert.' },
  D: { title: 'Die Bitch', summary: 'Wenn du wieder dran bist, ruft die Gruppe „Bitch 1“ bis „Bitch 5“. So viele Schlücke trinkst du.' },
  K: { title: 'Kategorie', summary: 'Das Rad nennt eine Kategorie. Wer nichts weiß oder doppelt nennt, trinkt.' },
  A: { title: 'Wasserfall', summary: 'Alle trinken, bis der Ass-Zieher aufhört. Wer früher absetzt, trinkt einen Shot.' },
}

export function sipsText(count: number): string {
  return count === 1 ? '1 Schluck' : `${count} Schlücke`
}
