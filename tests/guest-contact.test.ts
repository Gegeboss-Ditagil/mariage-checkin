import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { countryForPhone, flagEmoji, PHONE_COUNTRIES } from '../lib/countries.ts';

// v1.69.0, demande de Gersom le 07/10/2026 : "avant d'appeler, tu fais se
// mettre un petit drapeau. Comme ça, on sait quel pays." -- deduit du
// numero deja stocke au format international (+33...), jamais un champ
// supplementaire a saisir/importer.

test('countryForPhone retrouve le pays a partir de l\'indicatif international', () => {
  assert.equal(countryForPhone('+33612345678')?.code, 'FR');
  assert.equal(countryForPhone('+41791234567')?.code, 'CH');
  assert.equal(countryForPhone('+243812345678')?.code, 'CD');
});

test('countryForPhone prefere le prefixe le plus long (evite une confusion entre indicatifs de longueurs differentes)', () => {
  // +1 (Canada/US) est volontairement a 1 chiffre dans PHONE_COUNTRIES --
  // verifie que le tri decroissant ne casse pas un indicatif plus long par
  // ailleurs (ex: +351 Portugal ne doit jamais matcher via un prefixe +3[?]
  // plus court qui n'existe pas dans cette liste).
  assert.equal(countryForPhone('+351912345678')?.code, 'PT');
});

test('countryForPhone renvoie null pour un numero sans indicatif ou non reconnu', () => {
  assert.equal(countryForPhone('0612345678'), null);
  assert.equal(countryForPhone(null), null);
  assert.equal(countryForPhone(undefined), null);
  assert.equal(countryForPhone(''), null);
  // Indicatif reel mais hors de la liste volontairement courte de PHONE_COUNTRIES.
  assert.equal(countryForPhone('+86 138 0000 0000'), null);
});

test('flagEmoji produit le drapeau unicode a partir d\'un code ISO alpha-2', () => {
  assert.equal(flagEmoji('FR'), '🇫🇷');
  assert.equal(flagEmoji('ch'), '🇨🇭');
});

test('flagEmoji renvoie une chaine vide pour un code invalide (jamais de plantage)', () => {
  assert.equal(flagEmoji(''), '');
  assert.equal(flagEmoji('FRA'), '');
  assert.equal(flagEmoji('1A'), '');
});

test('chaque pays de PHONE_COUNTRIES a un drapeau calculable', () => {
  for (const country of PHONE_COUNTRIES) {
    assert.notEqual(flagEmoji(country.code), '', country.code + ' doit produire un drapeau');
  }
});

const guestContactSource = readFileSync(new URL('../components/GuestContactButton.tsx', import.meta.url), 'utf8');

test('GuestContactButton propose Appeler, WhatsApp ET SMS au meme endroit (jamais seulement un appel direct)', () => {
  assert.match(guestContactSource, /export function GuestContactButton/);
  assert.match(guestContactSource, /href=\{'tel:' \+ telephone\}/);
  assert.match(guestContactSource, /href=\{'https:\/\/wa\.me\/' \+ digits\}/);
  assert.match(guestContactSource, /href=\{'sms:' \+ smsNumber\}/);
});

test('GuestContactButton affiche le drapeau du pays quand il est connu', () => {
  assert.match(guestContactSource, /countryForPhone\(telephone\)/);
  assert.match(guestContactSource, /flagEmoji\(country\.code\)/);
});

const searchPageSource = readFileSync(new URL('../app/search/page.tsx', import.meta.url), 'utf8');

test('/search : le bouton de contact invite est un sibling du bouton de ligne (jamais imbrique dans un <button>, HTML invalide)', () => {
  const itemFn = searchPageSource.slice(
    searchPageSource.indexOf('function InvitationItem'),
    searchPageSource.indexOf('return (', searchPageSource.indexOf('function InvitationItem')) + 2000
  );
  // Le bouton de contact doit apparaitre APRES la fermeture du </button> de
  // la ligne, jamais entre son ouverture et sa fermeture.
  const buttonCloseIndex = itemFn.indexOf('</button>');
  const contactIndex = itemFn.indexOf('GuestContactButton');
  assert.ok(buttonCloseIndex > 0 && contactIndex > buttonCloseIndex, 'GuestContactButton doit venir apres </button>');
});

test('/search charge bien telephone dans le dataset "parcourir toutes les invitations" (sinon le bouton de contact ne peut jamais apparaitre en mode parcours)', () => {
  const browseSelect = searchPageSource.slice(searchPageSource.indexOf(".select('id, nom_affichage, groupe"), searchPageSource.indexOf(".select('id, nom_affichage, groupe") + 300);
  assert.match(browseSelect, /telephone/);
});
