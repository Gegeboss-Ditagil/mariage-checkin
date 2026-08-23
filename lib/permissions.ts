import type { Role } from './types';

export type Capability =
  | 'scan'
  | 'search'
  | 'viewDashboard'
  | 'viewTables'
  | 'viewStaff'
  | 'viewAllStaff'
  | 'checkin'
  | 'placement'
  | 'moveGuests'
  | 'assignOverflow'
  | 'manageOverflow'
  | 'manageMembers'
  | 'manageTags'
  | 'markNoShow'
  | 'addInvitation'
  | 'viewHistory'
  | 'resolveExceptions'
  | 'exportData'
  | 'adminPanel';

const ALL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'viewAllStaff', 'checkin', 'placement',
  'moveGuests', 'assignOverflow', 'manageOverflow', 'manageMembers', 'manageTags',
  'markNoShow', 'addInvitation', 'viewHistory', 'resolveExceptions',
  'exportData', 'adminPanel',
];

const OPERATIONAL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'checkin', 'placement',
  'moveGuests', 'assignOverflow', 'manageOverflow', 'manageMembers', 'manageTags',
  'markNoShow', 'addInvitation', 'viewHistory', 'resolveExceptions',
];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: ALL_CAPABILITIES,
  directeur: [...OPERATIONAL_CAPABILITIES, 'viewAllStaff'],
  placeur: OPERATIONAL_CAPABILITIES,
  // Agent scan (entree/QR) : n'a pas manageTags -- la gestion des etiquettes
  // (cote, roles staff, notable...) est reservee a admin/directeur/placeur.
  // Conserve manageMembers (renommer, gerer les membres du groupe) : seule
  // la gestion des etiquettes a ete retiree, sur demande explicite de
  // Gersom le 23/08/2026 -- ce role est la pour scanner/checker, pas pour
  // reclassifier les invites.
  agent_checkin: [
    'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'checkin',
    'assignOverflow', 'manageMembers', 'markNoShow', 'viewHistory',
    'resolveExceptions',
  ],
  visibilite: ['search', 'viewDashboard', 'viewTables', 'viewStaff', 'viewAllStaff'],
};

export function hasCapability(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && ROLE_CAPABILITIES[role].includes(capability);
}

export function landingPathForRole(role: Role): string {
  return role === 'directeur' || role === 'visibilite' ? '/dashboard' : '/scan';
}

// L'acces a la route reste protege par le middleware. La granularite du
// contenu est centralisee dans les capacites viewStaff/viewAllStaff et doit
// aussi etre verifiee dans l'API, jamais seulement dans l'interface.
const FULL_STAFF_PREFIXES = [
  '/scan', '/table', '/staff', '/checkin', '/search', '/dashboard', '/tables',
  '/plan-table', '/exceptions', '/history', '/placement', '/api',
];

const SCAN_STAFF_PREFIXES = [
  '/scan', '/table', '/staff', '/checkin', '/search', '/dashboard', '/tables',
  '/plan-table', '/exceptions', '/history', '/api',
];

const READ_ONLY_PREFIXES = ['/dashboard', '/tables', '/plan-table', '/staff', '/search', '/api'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function canAccessPath(role: Role, pathname: string): boolean {
  if (role === 'admin') return true;
  if (pathname === '/') return true;

  const prefixes =
    role === 'directeur' || role === 'placeur'
      ? FULL_STAFF_PREFIXES
      : role === 'agent_checkin'
      ? SCAN_STAFF_PREFIXES
      : READ_ONLY_PREFIXES;

  if (!prefixes.some((prefix) => matchesPrefix(pathname, prefix))) return false;

  if (role === 'agent_checkin') {
    // Note : /checkin/[invitationId]/merge n'est PAS dans cette liste --
    // matchesPrefix ne peut pas exprimer "bloquer un sous-chemin qui suit un
    // segment dynamique" (l'id de l'invitation vient avant "/merge"). La
    // page reste donc atteignable par URL directe pour ce role, mais
    // /api/invitations/merge ci-dessous refuse l'ecriture : meme filet de
    // securite que /tables/move/[invitationId] pour visibilite (l'API fait
    // sa propre verification). Voir docs/QE_QA_PROCESS.md section 5.
    return ![
      '/tables/move', '/tables/move-multiple', '/tables/overflow', '/tables/add',
      '/api/move-invitation', '/api/move-invitations', '/api/swap-invitations',
      '/api/overflow/move', '/api/overflow/unassign', '/api/invitations/add',
      '/api/invitations/merge',
    ].some((prefix) => matchesPrefix(pathname, prefix));
  }

  if (role === 'visibilite' && pathname.startsWith('/api/')) {
    // Les routes API appliquent aussi leur propre autorisation. Le middleware
    // laisse passer les lectures nécessaires au dashboard/recherche.
    return true;
  }

  return true;
}

