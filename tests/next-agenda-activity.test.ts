import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Demande de Gersom le 02/09/2026 (capture d'écran de /scan à l'appui) :
// "juste en haut du bouton approbation ... un bouton qui va nous amener à
// l'agenda, mais qui affiche directement c'est quoi la prochaine activité
// dans le chronogramme ... que ça n'affecte pas la page, que toutes les
// informations sont dans une seule page, pas besoin de scroll".
const componentSource = readFileSync(new URL('../components/NextAgendaActivity.tsx', import.meta.url), 'utf8');
const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
const scannerSource = readFileSync(new URL('../components/QrScanner.tsx', import.meta.url), 'utf8');

test("la prochaine activite est la premiere non terminee dans l'ordre du chronogramme, pas une comparaison a l'heure de l'appareil", () => {
  // Comparer a l'heure de l'appareil casserait sur les activites apres
  // minuit (01:00, 03:00, 05:00 dans le seed) et ne refleterait pas un
  // deroulement en avance/en retard -- s'appuie sur `completed`, deja coche
  // par le staff sur chaque activite (voir 0039_shared_agenda.sql).
  assert.match(componentSource, /items\.find\(\(item\) => !item\.completed\)/);
  assert.doesNotMatch(componentSource, /new Date\(\)/);
  assert.match(componentSource, /Chronogramme terminé/);
});

test("reservee a viewAgenda (memes roles que l'onglet Agenda) -- placeur/agent_checkin n'ont pas acces a /agenda", () => {
  assert.match(componentSource, /hasCapability\(role, ['"]viewAgenda['"]\)/);
  assert.match(componentSource, /href="\/agenda"/);
});

test("la bande est inseree juste au-dessus du raccourci Approbations sur /scan, et la camera retrecit pour laisser la place sans avoir besoin de scroller", () => {
  assert.match(scanPageSource, /\{role && <NextAgendaActivity role=\{role\} \/>\}\s*\n\s*\{role && <GuestApprovalsShortcut role=\{role\} \/>\}/);
  // Pourcentage de hauteur de la camera resserre en meme temps (55dvh -> 46dvh,
  // plancher 340 -> 320) pour que tout reste visible sans scroll -- doit
  // rester identique dans le composant QrScanner et son placeholder de
  // chargement, jamais desynchronise.
  assert.match(scanPageSource, /h-\[clamp\(320px,46dvh,620px\)\]/);
  assert.match(scannerSource, /h-\[clamp\(320px,46dvh,620px\)\]/);
});

// Corrige le 02/09/2026 (retour de Gersom, capture d'ecran en paysage a
// l'appui) : "quand on rotate l'iPhone ... la portion camera est plus
// petite ... ca va mal". Choix retenu parmi les deux proposes par Gersom :
// la camera devient carree a gauche, les trois cartes forment une colonne
// etroite a sa droite (plutot que rester empilees en pleine largeur sous
// une camera ecrasee par la faible hauteur du paysage).
test('en paysage, la camera devient carree a gauche et les trois cartes une colonne etroite a sa droite, sans scroll', () => {
  assert.match(scanPageSource, /landscape:flex landscape:flex-col landscape:overflow-hidden/);
  assert.match(scanPageSource, /landscape:flex-1 landscape:flex-row landscape:items-stretch/);
  assert.match(scanPageSource, /landscape:h-full landscape:shrink-0 landscape:items-stretch/);
  assert.match(scanPageSource, /landscape:min-w-\[220px\] landscape:flex-1 landscape:justify-center landscape:overflow-y-auto/);
  // Le titre se resume au strict minimum en paysage pour laisser toute la
  // hauteur disponible a la rangee camera + cartes.
  assert.match(scanPageSource, /eyebrow landscape:hidden/);
  assert.match(scanPageSource, /text-text-faint landscape:hidden/);
  // La camera elle-meme (composant + placeholder de chargement) passe en
  // carre plein-hauteur, jamais pleine largeur, en paysage.
  assert.match(scannerSource, /landscape:aspect-square landscape:h-full landscape:w-auto/);
  assert.match(scanPageSource, /landscape:aspect-square landscape:h-full landscape:w-auto/);
});
