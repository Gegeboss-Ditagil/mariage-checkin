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

