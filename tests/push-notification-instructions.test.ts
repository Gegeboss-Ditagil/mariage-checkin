import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 13/09/2026 : "j'aimerais que ça m'amène directement
// dans les settings iPhone [ou Android]... un peu comme le prompt caméra".
// Aucune API web ne permet d'ouvrir directement les réglages système de
// notifications d'une PWA (ni sur iOS ni sur Android), contrairement à
// getUserMedia (caméra) qui affiche sa propre invite native depuis la page
// -- restriction de plateforme, pas un choix de ce code. Le mieux
// possible : détecter précisément l'état (refusé / iOS pas encore
// installé) et donner le chemin exact à suivre dans les réglages du
// téléphone, plutôt qu'un message générique sans marche à suivre.
const pushButtonSource = readFileSync(new URL('../components/PushNotificationButton.tsx', import.meta.url), 'utf8');

test("un refus de notifications affiche des instructions precises par plateforme (iOS/Android/autre), pas un message generique", () => {
  assert.match(pushButtonSource, /function detectPlatform\(\)/);
  assert.match(pushButtonSource, /const DENIED_INSTRUCTIONS: Record<ReturnType<typeof detectPlatform>, string> = \{/);
  assert.match(pushButtonSource, /ios: "Réglages de l'iPhone/);
  assert.match(pushButtonSource, /android: "Appui long sur l'icône/);
  assert.match(pushButtonSource, /other: 'Autorisez les notifications pour ce site/);
});

test("sur iOS pas encore installe en PWA, le message explique comment l'ajouter a l'ecran d'accueil (seul prealable technique pour que le prompt de notification existe)", () => {
  const helpTextBlock = pushButtonSource.slice(pushButtonSource.indexOf('const helpText ='), pushButtonSource.indexOf('return ('));
  assert.match(helpTextBlock, /status === 'denied'/);
  assert.match(helpTextBlock, /status === 'in_app'/);
  assert.match(helpTextBlock, /Ajoutez d'abord cette page à l'écran d'accueil/);
  assert.match(helpTextBlock, /Sur l'écran d'accueil/);
});

test("les tests existants restent verts (label et logique inchangee, seule une aide contextuelle est ajoutee)", () => {
  assert.match(pushButtonSource, /Notification\.requestPermission\(\)/);
  assert.match(pushButtonSource, /display-mode: standalone/);
  assert.match(pushButtonSource, /Notifications activées/);
});
