// v1.82.3 : « Prochaine activité » basée sur l'heure réelle (retour de Gersom :
// « rendre basée sur l'heure »). Logique pure, sans React, testée sans base.
//
// Les heures de l'agenda sont du texte libre ("06:00", "12:30–13:30",
// "Avant 14:30", "23:30–00:00"). Le programme du jour J court de 06:00 jusqu'à
// 05:00 le lendemain : on les remet sur une seule ligne de temps continue
// (minutes depuis minuit du jour J, > 1440 après minuit) avant de comparer à
// l'heure de Paris. Une ligne cochée « terminé » est toujours sautée.

export type ScheduleItem = { time_label: string; completed: boolean };
export type TimedScheduleItem<T> = T & { startMin: number; endMin: number };

const DAY = 1440;
// Un retour en arrière de plus de 12 h entre deux lignes = passage de minuit.
const MIDNIGHT_DROP = 720;
// Une activité à heure unique (« 15:55 », « 19:00 ») dure jusqu'au début de la
// suivante, au plus ce nombre de minutes -- sinon elle disparaîtrait de la
// bande dès la minute d'après alors que l'action est encore en cours.
const POINT_GRACE_MIN = 30;
// « Avant 14:30 » : préparation qui précède l'heure (pas d'activité qui la suit).
const AVANT = /^[ \t]*avant(?![a-zà-ÿ])/i;
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
  const pointFlags: boolean[] = [];
  for (const item of items) {
    const parsed = parseTimeLabel(item.time_label);
    if (!parsed) {
      timed.push({ ...item, startMin: lastEnd, endMin: lastEnd });
      pointFlags.push(false);
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
    pointFlags.push(parsed.start === parsed.end && !AVANT.test(item.time_label));
  }
  // Activités à heure unique : fin = début de la prochaine activité plus tardive
  // (au plus POINT_GRACE_MIN). « Avant 14:30 » reste un instant : c'est une
  // préparation qui précède l'heure, pas une activité qui la suit.
  timed.forEach((entry, index) => {
    if (!pointFlags[index] || entry.endMin !== entry.startMin) return;
    const later = timed.slice(index + 1).map((other) => other.startMin).filter((other) => other > entry.startMin);
    entry.endMin = Math.min(entry.startMin + POINT_GRACE_MIN, later.length > 0 ? Math.min(...later) : Infinity);
  });
  return timed;
}

/** Minutes depuis minuit à Paris, quel que soit le fuseau de l'appareil. */
export function parisMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const mins = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hours * 60 + mins;
}

/**
 * Activité à afficher : parmi les non terminées qui ne sont pas passées (fin >=
 * maintenant), celle en cours qui a commencé en dernier (c'est ce que l'équipe
 * doit voir, ex. le rassemblement des VIP pendant la prestation de Laura
 * Humba) ; sinon la prochaine à venir (début le plus proche, ordre du
 * chronogramme en cas d'égalité). `inProgress` = elle a déjà commencé.
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
  const alive = timeline.filter((candidate) => !candidate.completed && candidate.endMin >= now);
  if (alive.length === 0) return null;
  const running = alive.filter((candidate) => candidate.startMin <= now);
  if (running.length > 0) {
    const latest = Math.max(...running.map((candidate) => candidate.startMin));
    return { item: running.find((candidate) => candidate.startMin === latest)!, inProgress: true };
  }
  const soonest = Math.min(...alive.map((candidate) => candidate.startMin));
  return { item: alive.find((candidate) => candidate.startMin === soonest)!, inProgress: false };
}

/**
 * Écart entre l'horloge du serveur et celle de l'appareil (ms, positif = le
 * téléphone est en retard), mesuré autour d'une requête : le serveur a daté sa
 * réponse au milieu de l'aller-retour. Un téléphone mal réglé (ou une date
 * réglée à la main) ne fausse donc plus la bande « Prochaine activité ».
 * Sans heure serveur lisible, aucune correction (0).
 */
export function estimateClockOffset(serverTimeMs: unknown, requestStartMs: number, responseEndMs: number): number {
  if (typeof serverTimeMs !== 'number' || !Number.isFinite(serverTimeMs)) return 0;
  return Math.round(serverTimeMs - (requestStartMs + responseEndMs) / 2);
}
