// v1.82.3 : « Prochaine activité » basée sur l'heure réelle (retour de Gersom :
// « rendre basée sur l'heure »). Logique pure, sans React, testée sans base.
//
// Les heures de l'agenda sont du texte libre ("06:00", "12:30–13:30",
// "Avant 14:30", "23:30–00:00"). Le programme du jour J court de 06:00 jusqu'à
// 05:00 le lendemain : on les remet sur une seule ligne de temps continue
// (minutes depuis minuit du jour J, > 1440 après minuit) avant de comparer à
// l'heure de Montréal. Une ligne cochée « terminé » est toujours sautée.

export type ScheduleItem = { time_label: string; completed: boolean };
export type TimedScheduleItem<T> = T & { startMin: number; endMin: number };

const DAY = 1440;
// Un retour en arrière de plus de 12 h entre deux lignes = passage de minuit.
const MIDNIGHT_DROP = 720;
const TIME_PATTERN = /(\d{1,2})\s*[:h]\s*(\d{2})/g;

/** Heures d'un libellé : une heure ("Avant 14:30" -> 14:30) ou une plage. */
export function parseTimeLabel(label: string): { start: number; end: number } | null {
  const minutes: number[] = [];
  for (const match of label.matchAll(TIME_PATTERN)) {
    const hours = Number(match[1]);
    const mins = Number(match[2]);
    if (hours > 23 || mins > 59) continue;
    minutes.push(hours * 60 + mins);
  }
  if (minutes.length === 0) return null;
  return { start: minutes[0], end: minutes[minutes.length - 1] };
}

/**
 * Ligne de temps continue dans l'ordre du chronogramme : ajoute 24 h dès que
 * l'heure repart nettement en arrière (apres minuit) et à la fin d'une plage
 * qui passe minuit (23:30–00:00). Un libellé sans heure suit la ligne précédente.
 */
export function withTimeline<T extends { time_label: string }>(items: T[]): TimedScheduleItem<T>[] {
  const timed: TimedScheduleItem<T>[] = [];
  let offset = 0;
  let lastStart = 0;
  let lastEnd = 0;
  for (const item of items) {
    const parsed = parseTimeLabel(item.time_label);
    if (!parsed) {
      timed.push({ ...item, startMin: lastEnd, endMin: lastEnd });
      continue;
    }
    let start = parsed.start + offset;
    if (timed.length > 0 && start < lastStart - MIDNIGHT_DROP) {
      offset += DAY;
      start += DAY;
    }
    let end = parsed.end + offset;
    if (end < start) end += DAY;
    lastStart = start;
    lastEnd = end;
    timed.push({ ...item, startMin: start, endMin: end });
  }
  return timed;
}

/** Minutes depuis minuit à Montréal (Chambly), quel que soit le fuseau de l'appareil. */
export function montrealMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Toronto',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const mins = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hours * 60 + mins;
}

/**
 * Première activité non terminée, dans l'ordre du chronogramme, qui n'est pas
 * déjà passée (fin >= maintenant). `inProgress` = elle a déjà commencé.
 * Avant la première heure du programme (ex. 02:00 du matin) on est dans la
 * partie « après minuit » de la veille si le programme passe minuit.
 */
export function pickNextActivity<T extends ScheduleItem>(
  items: T[],
  nowMinutes: number
): { item: T; inProgress: boolean } | null {
  const timeline = withTimeline(items);
  if (timeline.length === 0) return null;
  const dated = timeline.filter((entry) => parseTimeLabel(entry.time_label) !== null);
  if (dated.length === 0) {
    // Aucune heure lisible : ancien comportement, première ligne non terminée.
    const first = timeline.find((entry) => !entry.completed);
    return first ? { item: first, inProgress: false } : null;
  }
  const firstStart = Math.min(...dated.map((entry) => entry.startMin));
  const lastEnd = Math.max(...dated.map((entry) => entry.endMin));
  const now = nowMinutes < firstStart && nowMinutes + DAY <= lastEnd ? nowMinutes + DAY : nowMinutes;
  const entry = timeline.find((candidate) => !candidate.completed && candidate.endMin >= now);
  if (!entry) return null;
  return { item: entry, inProgress: entry.startMin <= now };
}
