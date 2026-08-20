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

const FULL_STAFF_PREFIXES = [
  '/scan', '/table', '/checkin', '/search', '/dashboard', '/tables',
  '/exceptions', '/history', '/placement', '/api',
];

const SCAN_STAFF_PREFIXES = [
  '/scan', '/table', '/checkin', '/search', '/dashboard', '/tables',
  '/exceptions', '/history', '/api',
];

const READ_ONLY_PREFIXES = ['/dashboard', '/tables', '/search', '/api'];

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
    return ![
      '/tables/move', '/tables/overflow', '/tables/add',
      '/api/move-invitation', '/api/overflow/move', '/api/overflow/unassign',
      '/api/invitations/add',
    ].some((prefix) => matchesPrefix(pathname, prefix));
  }

  if (role === 'visibilite' && pathname.startsWith('/api/')) {
    // Les routes API appliquent aussi leur propre autorisation. Le middleware
    // laisse passer les lectures nécessaires au dashboard/recherche.
    return true;
  }

  return true;
}
