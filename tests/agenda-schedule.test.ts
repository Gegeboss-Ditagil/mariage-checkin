import assert from 'node:assert/strict';
import test from 'node:test';
import { montrealMinutes, parseTimeLabel, pickNextActivity, withTimeline } from '../lib/agendaSchedule.ts';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const item = (time_label: string, title: string, completed = false) => ({ time_label, title, completed });

// Extrait réel du programme public du 24/10/2026 (ordre du chronogramme).
const PROGRAMME = [
  item('Avant 14:30', 'Préparation de l\'accueil'),
  item('14:30–15:00', 'Arrivée des invités'),
  item('15:00–15:45', 'Cérémonie religieuse'),
  item('15:55', 'Départ discret des mariés'),
  item('16:00', 'Vin d\'honneur'),
  item('16:35–17:40', 'Prestation de Laura Humba'),
  item('17:10', 'Rassemblement des invités VIP'),
  item('18:00', 'Ouverture de la salle principale'),
  item('23:30–00:00', 'Session de sebene avec AngoStars'),
  item('23:40–00:40', 'Changement de tenue de la mariée'),
  item('00:40', 'Deuxième entrée des mariés'),
  item('03:00', 'Fermeture du bar'),
  item('05:00', 'Fin de la soirée'),
];

const titleAt = (hours: number, minutes = 0, items = PROGRAMME) => pickNextActivity(items, h(hours, minutes))?.item.title;

test('parseTimeLabel : heure seule, plage, « Avant », format 14h30, libellé sans heure', () => {
  assert.deepEqual(parseTimeLabel('06:00'), { start: h(6), end: h(6) });
  assert.deepEqual(parseTimeLabel('12:30–13:30'), { start: h(12, 30), end: h(13, 30) });
  assert.deepEqual(parseTimeLabel('Avant 14:30'), { start: h(14, 30), end: h(14, 30) });
  assert.deepEqual(parseTimeLabel('14h30'), { start: h(14, 30), end: h(14, 30) });
  assert.equal(parseTimeLabel('Matin'), null);
  assert.equal(parseTimeLabel('25:99'), null);
});

test('withTimeline : après minuit la ligne de temps continue (> 24 h), plage 23:30–00:00 comprise', () => {
  const timeline = withTimeline(PROGRAMME);
  const byTitle = (title: string) => timeline.find((entry) => entry.title === title)!;
  assert.equal(byTitle('Session de sebene avec AngoStars').endMin, h(24));
  assert.equal(byTitle('Changement de tenue de la mariée').endMin, h(24, 40));
  assert.equal(byTitle('Deuxième entrée des mariés').startMin, h(24, 40));
  assert.equal(byTitle('Fermeture du bar').startMin, h(27));
  assert.equal(byTitle('Fin de la soirée').startMin, h(29));
});

test('prochaine activité : suit l\'heure (en cours / à venir)', () => {
  assert.equal(titleAt(14, 0), 'Préparation de l\'accueil');
  assert.equal(titleAt(14, 40), 'Arrivée des invités');
  assert.equal(titleAt(15, 30), 'Cérémonie religieuse');
  assert.equal(titleAt(15, 50), 'Départ discret des mariés');
  assert.equal(titleAt(15, 59), 'Départ discret des mariés'); // 15:55 dure jusqu'à 16:00
  assert.equal(titleAt(16, 1), "Vin d'honneur");
  assert.equal(titleAt(16, 40), 'Prestation de Laura Humba');
  assert.equal(titleAt(17, 45), 'Ouverture de la salle principale');
  assert.equal(pickNextActivity(PROGRAMME, h(15, 30))?.inProgress, true);
  assert.equal(pickNextActivity(PROGRAMME, h(14, 0))?.inProgress, false);
});

test('prochaine activité : après minuit (00:20, 02:00) reste dans le programme du jour J', () => {
  assert.equal(titleAt(0, 20), 'Changement de tenue de la mariée');
  assert.equal(titleAt(0, 50), 'Deuxième entrée des mariés'); // 00:40 dure jusqu'à 01:10
  assert.equal(titleAt(1, 30), 'Fermeture du bar');
  assert.equal(titleAt(2, 0), 'Fermeture du bar');
  assert.equal(titleAt(4, 0), 'Fin de la soirée');
});

test('prochaine activité : une ligne cochée « terminé » est sautée, la bande avance sans attendre l\'heure', () => {
  const done = PROGRAMME.map((entry) => (entry.title === 'Cérémonie religieuse' ? { ...entry, completed: true } : entry));
  assert.equal(titleAt(15, 30, done), 'Départ discret des mariés');
});

test('prochaine activité : tout coché -> null ; liste vide -> null ; après 05:00 -> première ligne à venir', () => {
  // 05:45 : après la fin du programme, la prochaine à venir est la première ligne, jamais « en cours ».
  assert.equal(titleAt(5, 45), "Préparation de l'accueil");
  assert.equal(pickNextActivity(PROGRAMME, h(5, 45))?.inProgress, false);
  const allDone = PROGRAMME.map((entry) => ({ ...entry, completed: true }));
  assert.equal(pickNextActivity(allDone, h(15)), null);
  assert.equal(pickNextActivity([], h(15)), null);
});

test('prochaine activité : libellés sans heure -> première ligne non terminée', () => {
  const sansHeure = [item('Matin', 'A', true), item('Après-midi', 'B')];
  assert.equal(pickNextActivity(sansHeure, h(15))?.item.title, 'B');
});

test('montrealMinutes : heure de Montréal quel que soit le fuseau de l\'appareil (EDT en octobre)', () => {
  assert.equal(montrealMinutes(new Date('2026-10-24T19:30:00Z')), h(15, 30));
  assert.equal(montrealMinutes(new Date('2026-10-25T04:40:00Z')), h(0, 40));
  // Après le passage à l'heure d'hiver (1er novembre 2026) : UTC-5.
  assert.equal(montrealMinutes(new Date('2026-11-02T20:30:00Z')), h(15, 30));
});

test('activité à heure unique : reste « en cours » jusqu\'à la suivante (au plus 30 min), jamais « Avant » qui précède l\'heure', () => {
  // 15:55 « Départ discret des mariés » ne disparaît pas à 15:56.
  assert.equal(pickNextActivity(PROGRAMME, h(15, 56))?.inProgress, true);
  assert.equal(titleAt(15, 56), 'Départ discret des mariés');
  // Plafond de 30 min : 17:10 « Rassemblement » est fini à 17:41.
  const seul = [item('17:10', 'Rassemblement'), item('20:00', 'Buffet')];
  assert.equal(pickNextActivity(seul, h(17, 25))?.item.title, 'Rassemblement');
  assert.equal(pickNextActivity(seul, h(17, 41))?.item.title, 'Buffet');
  // « Avant 14:30 » reste un instant : à 14:45 c'est l'arrivée des invités.
  assert.equal(titleAt(14, 45), 'Arrivée des invités');
});

test('plusieurs activités en cours : celle qui a commencé en dernier est affichée', () => {
  // 17:12 : la prestation de Laura Humba (16:35) et le rassemblement des VIP (17:10) sont en cours.
  assert.equal(titleAt(17, 12), 'Rassemblement des invités VIP');
  assert.equal(pickNextActivity(PROGRAMME, h(17, 12))?.inProgress, true);
  // Rassemblement (17:10) borné par l'embarquement (17:15–17:25) : la prestation redevient l'activité affichée.
  const reel = [item('16:35–17:40', 'Prestation de Laura Humba'), item('17:10', 'Rassemblement des invités VIP'), item('17:15–17:25', 'Embarquement des VIP')];
  assert.equal(pickNextActivity(reel, h(17, 12))?.item.title, 'Rassemblement des invités VIP');
  assert.equal(pickNextActivity(reel, h(17, 20))?.item.title, 'Embarquement des VIP');
  assert.equal(pickNextActivity(reel, h(17, 30))?.item.title, 'Prestation de Laura Humba');
});

test('plusieurs à venir : la plus proche dans le temps, ordre du chronogramme en cas d\'égalité', () => {
  const egalite = [item('18:00', 'A'), item('18:00', 'B'), item('19:00', 'C')];
  assert.equal(pickNextActivity(egalite, h(17))?.item.title, 'A');
});
