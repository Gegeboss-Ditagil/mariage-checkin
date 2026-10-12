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
  assert.equal(titleAt(15, 59), 'Vin d\'honneur');
  assert.equal(titleAt(16, 40), 'Prestation de Laura Humba');
  assert.equal(titleAt(17, 45), 'Ouverture de la salle principale');
  assert.equal(pickNextActivity(PROGRAMME, h(15, 30))?.inProgress, true);
  assert.equal(pickNextActivity(PROGRAMME, h(14, 0))?.inProgress, false);
});

test('prochaine activité : après minuit (00:20, 02:00) reste dans le programme du jour J', () => {
  assert.equal(titleAt(0, 20), 'Changement de tenue de la mariée');
  assert.equal(titleAt(0, 50), 'Fermeture du bar');
  assert.equal(titleAt(2, 0), 'Fermeture du bar');
  assert.equal(titleAt(4, 0), 'Fin de la soirée');
});

test('prochaine activité : une ligne cochée « terminé » est sautée, la bande avance sans attendre l\'heure', () => {
  const done = PROGRAMME.map((entry) => (entry.title === 'Cérémonie religieuse' ? { ...entry, completed: true } : entry));
  assert.equal(titleAt(15, 30, done), 'Départ discret des mariés');
});

test('prochaine activité : tout coché -> null ; liste vide -> null ; après 05:00 -> première ligne à venir', () => {
  // 05:30 : après la fin du programme, la prochaine à venir est la première ligne, jamais « en cours ».
  assert.equal(titleAt(5, 30), "Préparation de l'accueil");
  assert.equal(pickNextActivity(PROGRAMME, h(5, 30))?.inProgress, false);
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
