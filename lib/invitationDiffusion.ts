export const CANVA_INVITATION_BASE_URL = 'https://libalz.my.canva.site/vol-';

export const DEFAULT_INVITATION_MESSAGE = `Bonjour {famille},

Nelly et Gersom ont le plaisir de vous transmettre leur invitation de mariage.

Vous pouvez consulter les informations concernant votre invitation ici :
{lien_invitation}

Cette invitation est prévue pour {nombre_personnes} personne(s).

Nous avons hâte de célébrer cette belle journée avec vous.

Nelly & Gersom`;

export type DiffusionField =
  | 'famille'
  | 'prenom'
  | 'telephone'
  | 'email'
  | 'code_invitation'
  | 'nombre_personnes'
  | 'langue'
  | 'canal_prefere'
  | 'statut'
  | 'notes';

export interface DiffusionContact {
  id: string;
  famille: string;
  prenom: string;
  telephone: string;
  email: string;
  codeInvitation: string;
  nombrePersonnes: number;
  langue: string;
  canalPrefere: string;
  statut: string;
  notes: string;
  erreurs: string[];
}

export const DIFFUSION_FIELDS: Array<{ key: DiffusionField; label: string; required?: boolean }> = [
  { key: 'famille', label: 'Famille / nom affiché', required: true },
  { key: 'prenom', label: 'Prénom' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'code_invitation', label: 'Code invitation (T010/F004)', required: true },
  { key: 'nombre_personnes', label: 'Nombre de personnes' },
  { key: 'langue', label: 'Langue' },
  { key: 'canal_prefere', label: 'Canal préféré' },
  { key: 'statut', label: 'Statut d’envoi' },
  { key: 'notes', label: 'Notes' },
];

const FIELD_ALIASES: Record<DiffusionField, string[]> = {
  famille: ['famille', 'groupe', 'nom affichage', 'nom_affichage', 'party', 'household'],
  prenom: ['prenom', 'prénom', 'first name', 'firstname'],
  telephone: ['telephone', 'téléphone', 'phone', 'phone number', 'mobile', 'whatsapp'],
  email: ['email', 'e-mail', 'courriel', 'mail'],
  code_invitation: ['code invitation', 'code_invitation', 'code vol', 'vol', 'flight code', 'tag table'],
  nombre_personnes: ['nombre personnes', 'nombre_personnes', 'nombre prevu', 'nombre_prevu', 'personnes', 'guests'],
  langue: ['langue', 'language'],
  canal_prefere: ['canal prefere', 'canal préféré', 'canal_prefere', 'channel'],
  statut: ['statut', 'status', 'statut envoi', 'statut_envoi'],
  notes: ['notes', 'note', 'commentaire', 'comments'],
};

function normalizedText(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function autoMapDiffusionHeaders(headers: string[]): Partial<Record<DiffusionField, string>> {
  const mapping: Partial<Record<DiffusionField, string>> = {};
  for (const field of DIFFUSION_FIELDS) {
    const aliases = FIELD_ALIASES[field.key].map(normalizeHeader);
    const exact = headers.find((header) => aliases.includes(normalizeHeader(header)));
    if (exact) mapping[field.key] = exact;
  }
  return mapping;
}

export function normalizeInvitationCode(value: unknown): string {
  return normalizedText(value)
    .toUpperCase()
    .replace(/^VOL[\s_-]*/, '')
    .replace(/[\s_-]+/g, '');
}

export function invitationLink(code: string): string | null {
  const normalized = normalizeInvitationCode(code);
  return /^[FT]\d{3}$/.test(normalized) ? CANVA_INVITATION_BASE_URL + normalized.toLowerCase() : null;
}

export function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function renderInvitationMessage(template: string, contact: DiffusionContact): string {
  const link = invitationLink(contact.codeInvitation) || '[LIEN INVALIDE]';
  const replacements: Record<string, string> = {
    famille: contact.famille,
    prenom: contact.prenom,
    code_invitation: contact.codeInvitation,
    lien_invitation: link,
    nombre_personnes: String(contact.nombrePersonnes),
    langue: contact.langue,
  };
  return template.replace(/\{([a-z_]+)\}/g, (full, key: string) => replacements[key] ?? full);
}

export function whatsappLink(contact: DiffusionContact, message: string): string | null {
  const digits = whatsappDigits(contact.telephone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export function emailLink(contact: DiffusionContact, message: string): string | null {
  if (!isValidEmail(contact.email)) return null;
  const subject = encodeURIComponent('Invitation au mariage de Nelly & Gersom');
  return `mailto:${encodeURIComponent(contact.email)}?subject=${subject}&body=${encodeURIComponent(message)}`;
}

export function parseDiffusionRows(
  rows: Record<string, unknown>[],
  mapping: Partial<Record<DiffusionField, string>>
): DiffusionContact[] {
  const read = (row: Record<string, unknown>, field: DiffusionField) =>
    mapping[field] ? normalizedText(row[mapping[field] as string]) : '';

  return rows.map((row, index) => {
    const famille = read(row, 'famille');
    const telephone = read(row, 'telephone');
    const email = read(row, 'email');
    const codeInvitation = normalizeInvitationCode(read(row, 'code_invitation'));
    const parsedCount = Number(read(row, 'nombre_personnes'));
    const nombrePersonnes = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    const erreurs: string[] = [];

    if (!famille) erreurs.push('Famille manquante');
    if (!invitationLink(codeInvitation)) erreurs.push('Code attendu : T010 ou F004');
    if (!telephone && !email) erreurs.push('Téléphone et email manquants');
    if (telephone && !whatsappDigits(telephone)) erreurs.push('Téléphone invalide');
    if (email && !isValidEmail(email)) erreurs.push('Email invalide');

    return {
      id: `ligne-${index + 2}`,
      famille,
      prenom: read(row, 'prenom'),
      telephone,
      email,
      codeInvitation,
      nombrePersonnes,
      langue: read(row, 'langue') || 'Français',
      canalPrefere: read(row, 'canal_prefere') || (telephone ? 'WhatsApp' : email ? 'Email' : ''),
      statut: read(row, 'statut') || 'À envoyer',
      notes: read(row, 'notes'),
      erreurs,
    };
  });
}
