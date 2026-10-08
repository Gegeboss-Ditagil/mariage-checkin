// v1.73.0 (QA terrain avec Gersom) : filtres PostgREST de /search, extraits
// en fonctions pures pour etre testes sans navigateur.
//
// Trois defauts constates en vrai sur la preview :
// 1. « MAKONGO roger » ne trouvait pas « Roger Makongo » : la saisie entiere
//    etait cherchee comme UNE sous-chaine. Desormais chaque mot doit etre
//    present (dans n'importe quel champ), dans n'importe quel ordre.
// 2. Une virgule ou une parenthese tapee (« Isey (Godart) ») cassait la
//    syntaxe de `.or()` de PostgREST : la requete echouait, liste vide.
//    Ces caracteres sont neutralises avant d'ecrire le filtre.
// 3. « Remy » ne trouvait pas « Rémy » (ilike ne gere pas les accents) :
//    chaque e/é/è/ê/ë tape devient le joker `_` d'un seul caractere.

export type SearchMode = 'nom' | 'telephone' | 'email';

// Caracteres reserves de la syntaxe de filtre PostgREST (`,` `(` `)`), jokers
// LIKE (`%` `*`), guillemets et barre oblique inverse.
const RESERVED = /[,()%*"\\]/g;
const E_VARIANTS = /[eéèêëEÉÈÊË]/g;

export function sanitizeSearchText(text: string): string {
  return text.replace(RESERVED, ' ').replace(/\s+/g, ' ').trim();
}

function likeWord(word: string): string {
  // Le joker n'est applique qu'a partir de 3 caracteres, pour ne pas
  // transformer une saisie tres courte en motif qui correspond a tout.
  return word.length >= 3 ? word.replace(E_VARIANTS, '_') : word;
}

export function phoneDigitSuffix(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 5 ? digits.slice(-8) : null;
}

/**
 * Renvoie une liste de groupes `.or()` a appliquer CHACUN sur la requete
 * (PostgREST les combine en ET). Liste vide = rien a chercher.
 */
export function buildInvitationSearchFilters(mode: SearchMode, raw: string): string[] {
  const text = sanitizeSearchText(raw);
  if (!text) return [];
  const suffix = phoneDigitSuffix(text);

  if (mode === 'telephone') {
    return suffix ? ['telephone_digits.ilike.%' + suffix + '%'] : [];
  }
  if (mode === 'email') {
    return ['email.ilike.%' + text.replace(/\s+/g, '') + '%'];
  }

  // Mode nom : une saisie sans lettre et d'au moins 5 chiffres est un
  // numero de telephone (« 07 45 98 64 55 », « +33745986455 »).
  if (!/\p{L}/u.test(text) && suffix) {
    return ['telephone_digits.ilike.%' + suffix + '%'];
  }

  return text.split(' ').map((word) => {
    const w = likeWord(word);
    return ['nom_affichage', 'groupe', 'notes', 'email'].map((field) => field + '.ilike.%' + w + '%').join(',');
  });
}

/** « table 30 », « Table 30 » ou « 30 » cherchent tous la table 30. */
export function tableSearchText(raw: string): string {
  return raw.trim().toLowerCase().replace(/^table\s+/, '');
}
