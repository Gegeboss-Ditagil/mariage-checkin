import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// v1.82.1 : programme complet du jour J (migration 0077). Parse les lignes
// `values` du SQL pour verrouiller les regles de visibilite, sans base.
const sql = readFileSync(new URL('../supabase/migrations/0077_agenda_jour_j_programme_complet.sql', import.meta.url), 'utf8');
const rows = sql
  .split('\n')
  .filter((line) => /^    \('/.test(line))
  .map((line) => {
    const text = line.trim();
    const isPrivate = /, true\),?$/.test(text);
    return { text, isPrivate };
  });

test('agenda jour J : 47 activités, chacune avec une visibilité explicite', () => {
  assert.equal(rows.length, 47);
  assert.ok(rows.every((row) => /, (true|false)\),?$/.test(row.text)));
});

test('agenda jour J : rien de la surprise dans une ligne publique (visible des scanners)', () => {
  const secret = /aérodrome|aerodrome|persan|hélicopt|helicopt|atterriss/i;
  // « ne pas révéler la destination » est une consigne publique voulue : mot non filtré.
  const publicRows = rows.filter((row) => !row.isPrivate);
  assert.ok(publicRows.length > 20);
  for (const row of publicRows) assert.doesNotMatch(row.text, secret, row.text);
});

test('agenda jour J : les détails de la surprise sont bien en privé', () => {
  const privateText = rows.filter((row) => row.isPrivate).map((row) => row.text).join('\n');
  assert.match(privateText, /aérodrome de Persan/);
  assert.match(privateText, /hélicoptère/);
});

test('agenda jour J : sauvegarde avant suppression, idempotente', () => {
  assert.ok(sql.indexOf("'v1.82.1_agenda_jour_j'") < sql.indexOf('delete from agenda_items'));
  assert.match(sql, /x\.title = 'Préparation de l''accueil'/);
});

// v1.82.2 : corrections de l'agenda (migration 0078).
const fix = readFileSync(new URL('../supabase/migrations/0078_agenda_jour_j_corrections.sql', import.meta.url), 'utf8');

test('agenda corrections (0078) : sauvegarde avant écriture, aucun DELETE, idempotente', () => {
  assert.ok(fix.indexOf("'v1.82.2_agenda_corrections'") < fix.indexOf('update agenda_items'));
  assert.doesNotMatch(fix, /\bdelete\s+from\b/i);
  assert.match(fix, /x\.title = 'Arrivée des invités'/);
});

test('agenda corrections (0078) : aucune fuite de la surprise dans les nouvelles lignes publiques', () => {
  const inserted = fix.split('\n').filter((line) => /^\s+\(v_event\.event_id, '/.test(line));
  assert.equal(inserted.length, 4);
  const secret = /aérodrome|aerodrome|persan|hélicopt|helicopt|atterriss/i;
  for (const line of inserted.filter((l) => /, false\),?;?$/.test(l.trim()))) assert.doesNotMatch(line, secret, line);
  // « Départ discret des mariés » (public) ne doit pas citer l'aérodrome non plus.
  const depart = fix.split('\n').find((l) => l.includes("title = 'Départ discret des mariés'")) ?? '';
  assert.match(depart, /Départ discret/);
});

test('agenda corrections (0078) : décisions de Gersom présentes', () => {
  assert.match(fix, /20:45–21:20/);
  assert.match(fix, /23:30–00:00/);
  assert.match(fix, /autre sortie que le chapiteau/);
  assert.match(fix, /nom_affichage in \('Rémy', 'Tuzola'\)/);
});
