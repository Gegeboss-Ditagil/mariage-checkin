import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Demande de Gersom le 17/09/2026 (message vocal, en reponse a une capture
// d'ecran de /agenda) : "je vais mettre un petit option, privé ou pas...
// c'est vraiment caché de tous, sauf pour les directeurs de festin et
// administrateurs" -- reutilise la capacite existante `manageAgenda` (deja
// reservee a admin/directeur, lib/permissions.ts), aucune nouvelle capacite.
const migration = readFileSync(new URL('../supabase/migrations/0058_agenda_items_private.sql', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../app/api/agenda/route.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');

test('la migration 0058 ajoute is_private (boolean, defaut false) a agenda_items', () => {
  assert.match(migration, /alter table public\.agenda_items/);
  assert.match(migration, /add column if not exists is_private boolean not null default false/);
});

test('GET /api/agenda filtre les elements prives cote serveur pour tout role sans manageAgenda -- jamais un masquage client', () => {
  assert.match(apiSource, /const canManage = hasCapability\(user\.role, ['"]manageAgenda['"]\)/);
  assert.match(apiSource, /canManage \? normalized : normalized\.filter\(\(item\) => !item\.is_private\)/);
  // Le filtrage doit s'appliquer AVANT la reponse JSON -- jamais renvoyer
  // tous les items puis laisser le client trier (fuite reseau).
  assert.match(apiSource, /items: visible/);
});

test("normalizeAgendaItem garantit is_private=false si la colonne manque encore en base (meme filet que custom_assignees, v1.33.1)", () => {
  assert.match(apiSource, /is_private: item\.is_private === true/);
});

test('POST et PATCH /api/agenda acceptent is_private, coerce en booleen strict', () => {
  assert.match(apiSource, /is_private: body\.is_private === true/);
  assert.match(apiSource, /'sort_order', 'assignee_ids', 'custom_assignees', 'completed', 'is_private'/);
  assert.match(apiSource, /if \('is_private' in updates\) updates\.is_private = updates\.is_private === true;/);
});

test('les deux modales (Nouvelle activite, Modifier) ont une case a cocher "Privé" avec le meme texte explicatif', () => {
  const occurrences = pageSource.match(/Visible seulement par les directeurs de festin et les administrateurs/g) || [];
  assert.equal(occurrences.length, 2);
  assert.match(pageSource, /<input type="checkbox" name="is_private" className="mt-1 h-5 w-5" \/>/);
  assert.match(pageSource, /<input type="checkbox" name="is_private" defaultChecked=\{editing\.is_private\} className="mt-1 h-5 w-5" \/>/);
  assert.match(pageSource, /is_private: form\.get\('is_private'\) === 'on'/);
});

test('un badge "Privé" est affiche sur la carte -- uniquement recu par admin/directeur puisque l\'API filtre deja les autres roles', () => {
  assert.match(pageSource, /\{item\.is_private && <span[^>]*>Privé<\/span>\}/);
});

test("is_private: boolean fait partie du type AgendaItem cote client", () => {
  assert.match(pageSource, /is_private: boolean/);
});
