import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.66.1, retour de Gersom (03/10/2026) : « il y a quelque chose qui ne
// fonctionne pas au niveau du README. On est rendu comme à 1.66... ça veut
// dire que tu ne mettais pas à jour le README à chaque fois... on n'est
// plus avec le processus en place pour que ce soit bien testé. » Audit
// complet mené avant correction (docs/QE_QA_PROCESS.md, "chercher les cas
// similaires par une requête groupée") : README.md affichait encore
// « Version actuelle : 1.53.0 » (texte) ET un badge shields.io distinct
// bloqué sur 1.46.1 -- deux copies indépendantes du même fait, dérivées
// séparément sur plus de dix versions, jamais détectées faute d'un test.
// Les autres documents versionnés (DEPLOIEMENT.md, ASSIGNATION_TABLES.md,
// vérifiés manuellement pendant cet audit) portent aussi un numéro de
// version antérieur à 1.66.0, mais leur CONTENU reste factuellement exact
// -- conforme à la règle déjà écrite dans docs/VERSIONING.md ("un merge qui
// modifie uniquement du texte sans changer le comportement peut conserver
// la version courante"). README.md est différent : il affiche une
// "Version actuelle" explicite, une promesse factuelle sur l'état de
// l'app, qui devient littéralement fausse si elle dérive -- jamais
// seulement une question de ponctualité éditoriale. Ce test verrouille
// mécaniquement cette promesse précise (jamais le contenu narratif du
// reste du fichier, qui continue de n'être mis à jour que quand pertinent) :
// il échoue désormais à chaque bump de `package.json` tant que README.md
// n'a pas été touché en conséquence, intégré à la suite `node --test
// tests/*.test.ts` déjà obligatoire avant tout push (voir CLAUDE.md).

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readmeSource = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README.md : "Version actuelle" correspond exactement à package.json (jamais une dérive silencieuse)', () => {
  const match = readmeSource.match(/\*\*Version actuelle\s*:\s*([\d.]+)\*\*/);
  assert.ok(match, 'README.md doit porter une ligne "**Version actuelle : X.Y.Z**"');
  assert.equal(match![1], version, `README.md affiche la version ${match![1]}, attendu ${version} (package.json)`);
});

test('README.md : le badge shields.io de version correspond aussi à package.json (deuxième copie indépendante, découverte dérivée séparément du texte)', () => {
  const match = readmeSource.match(/img\.shields\.io\/badge\/version-([\d.]+)-blue/);
  assert.ok(match, 'README.md doit porter un badge shields.io "version-X.Y.Z-blue"');
  assert.equal(match![1], version, `le badge de version affiche ${match![1]}, attendu ${version} (package.json)`);
});

test("README.md n'épingle plus un numéro de version dans la section « Release actuelle » (source garantie de dérive future, déjà périmée une fois — v1.37.0 alors que l'app était à 1.53.0)", () => {
  const section = readmeSource.slice(readmeSource.indexOf('## Release actuelle'));
  assert.doesNotMatch(section, /\bv\d+\.\d+\.\d+\b/, 'pointer vers CHANGELOG.md/package.json plutôt que répéter un numéro de version en dur ici');
});
