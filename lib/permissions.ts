import type { Role } from './types';

export type Capability =
  | 'scan'
  | 'search'
  | 'viewDashboard'
  | 'viewTables'
  | 'checkin'
  | 'placement'
  | 'moveGuests'
  | 'assignOverflow'
  | 'manageOverflow'
  | 'manageMembers'
  | 'markNoShow'
  | 'addInvitation'
  | 'viewHistory'
  | 'resolveExceptions'
  | 'exportData'
  | 'adminPanel';

const ALL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'checkin', 'placement',
  'moveGuests', 'assignOverflow', 'manageOverflow', 'manageMembers',
  'markNoShow', 'addInvitation', 'viewHistory', 'resolveExceptions',
  'exportData', 'adminPanel',
];

const OPERATIONAL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'checkin', 'placement',
  'moveGuests', 'assignOverflow', 'manageOverflow', 'manageMembers',
  'markNoShow', 'addInvitation', 'viewHistory', 'resolveExceptions',
];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: ALL_CAPABILITIES,
  directeur: OPERATIONAL_CAPABILITIES,
  placeur: OPERATIONAL_CAPABILITIES,
  agent_checkin: [
    'scan', 'search', 'viewDashboard', 'viewTables', 'checkin',
    'assignOverflow', 'manageMembers', 'markNoShow', 'viewHistory',
    'resolveExceptions',
  ],
  visibilite: ['search', 'viewDashboard', 'viewTables'],
};

export function hasCapability(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && ROLE_CAPABILITIES[role].includes(capability);
}

export function landingPathForRole(role: Role): string {
  return role === 'directeur' || role === 'visibilite' ? '/dashboard' : '/scan';
}

// /staff reste accessible aux quatre roles operationnels ainsi qu'a
// visibilite en lecture seule. Le contenu est filtre dans app/staff/page.tsx :
// placeur et agent_checkin ne voient que le personnel sans table, tandis
// qu'admin, directeur et visibilite voient l'ensemble du staff.
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

