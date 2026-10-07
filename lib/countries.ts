export interface CountryOption {
  code: string;
  nom: string;
  indicatif: string; // ex: "+33"
  exemple: string; // exemple de numero NATIONAL (sans l'indicatif), tel qu'a saisir
}

/**
 * Liste volontairement courte : les pays reellement presents parmi les
 * invites (Europe de l'Ouest, Amerique du Nord, Afrique centrale
 * francophone/lusophone). Sert uniquement a guider la saisie d'un numero de
 * telephone dans le bon format (comme WithJoy le fait a l'import), pour
 * eviter les erreurs classiques ("0033..." au lieu de "+33...").
 */
export const PHONE_COUNTRIES: CountryOption[] = [
  { code: 'FR', nom: 'France', indicatif: '+33', exemple: '6 12 34 56 78' },
  { code: 'BE', nom: 'Belgique', indicatif: '+32', exemple: '470 12 34 56' },
  { code: 'CH', nom: 'Suisse', indicatif: '+41', exemple: '79 123 45 67' },
  { code: 'CA', nom: 'Canada', indicatif: '+1', exemple: '514 123 4567' },
  { code: 'US', nom: 'États-Unis', indicatif: '+1', exemple: '212 123 4567' },
  { code: 'GB', nom: 'Royaume-Uni', indicatif: '+44', exemple: '7911 123456' },
  { code: 'DE', nom: 'Allemagne', indicatif: '+49', exemple: '151 23456789' },
  { code: 'PT', nom: 'Portugal', indicatif: '+351', exemple: '912 345 678' },
  { code: 'ES', nom: 'Espagne', indicatif: '+34', exemple: '612 34 56 78' },
  { code: 'IT', nom: 'Italie', indicatif: '+39', exemple: '312 345 6789' },
  { code: 'NL', nom: 'Pays-Bas', indicatif: '+31', exemple: '6 12345678' },
  { code: 'CD', nom: 'RD Congo', indicatif: '+243', exemple: '81 234 5678' },
  { code: 'CG', nom: 'Congo-Brazzaville', indicatif: '+242', exemple: '06 123 4567' },
  { code: 'AO', nom: 'Angola', indicatif: '+244', exemple: '923 456 789' },
];

/**
 * Retrouve le pays correspondant a un numero deja au format international
 * (ex: "+33612345678", tel que stocke dans invitations.telephone/users.phone
 * -- voir cleanPhone dans lib/withjoyImport.ts, l'indicatif n'est jamais
 * retire a l'import). Tri par longueur d'indicatif decroissante pour que
 * "+243" (RD Congo) ne soit jamais pris pour un prefixe de "+24x" plus
 * court s'il en existait un. Retourne null si l'indicatif ne correspond a
 * aucun pays de cette liste volontairement courte (ex: +243 Congo encore
 * non couvert) -- l'appelant doit alors omettre le drapeau plutot que d'en
 * deviner un.
 */
export function countryForPhone(phone: string | null | undefined): CountryOption | null {
  if (!phone) return null;
  const digits = phone.trim().replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) return null;
  const parPrefixeDecroissant = [...PHONE_COUNTRIES].sort((a, b) => b.indicatif.length - a.indicatif.length);
  return parPrefixeDecroissant.find((c) => digits.startsWith(c.indicatif)) || null;
}

const FLAG_REGIONAL_INDICATOR_A = 0x1f1e6;

/** Emoji drapeau a partir d'un code pays ISO 3166-1 alpha-2 (ex: "FR" -> 🇫🇷). */
export function flagEmoji(isoCode: string): string {
  const code = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  const points = [...code].map((char) => FLAG_REGIONAL_INDICATOR_A + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}

