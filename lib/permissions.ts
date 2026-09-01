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
  | 'mergeInvitations'
  | 'assignOverflow'
  | 'manageOverflow'
  | 'manageMembers'
  | 'manageTags'
  | 'callStaff'
  | 'messageContacts'
  | 'markNoShow'
  | 'addInvitation'
  | 'viewHistory'
  | 'resolveExceptions'
  | 'viewGuestApprovals'
  | 'viewAgenda'
  | 'manageAgenda'
  | 'submitGuestApproval'
  | 'reviewGuestApproval'
  | 'assignGuestApproval'
  | 'exportData'
  | 'adminPanel';

const ALL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'viewAllStaff', 'checkin', 'placement',
  'moveGuests', 'mergeInvitations', 'assignOverflow', 'manageOverflow', 'manageMembers', 'manageTags', 'callStaff',
  'messageContacts',
  'markNoShow', 'addInvitation', 'viewHistory', 'resolveExceptions',
  'viewGuestApprovals', 'viewAgenda', 'manageAgenda', 'submitGuestApproval', 'reviewGuestApproval', 'assignGuestApproval',
  'exportData', 'adminPanel',
];

// viewHistory (journal /history) n'est PAS dans OPERATIONAL_CAPABILITIES --
// demande explicite de Gersom le 30/08/2026 : "ce n'est pas tous les roles
// qui ont acces a l'historique, donne l'acces seulement aux admins". Reste
// disponible pour admin via ALL_CAPABILITIES seulement (ci-dessus), retire
// de directeur/placeur/agent_checkin qui l'avaient via ce socle commun.
// Le flux invite surprise est volontairement separe en quatre capacites :
// admin/placeur/directeur prennent la photo; dans l'application, admin,
// directeur et visibilite approuvent/refusent puis peuvent choisir la table.
// Le placeur conserve la lecture, la soumission et l'assignation. Par texto
// ou WhatsApp, l'approbateur ne fait que Oui/Non : jamais de choix de table.
// agent_checkin ne participe jamais a ce flux et renvoie vers un placeur.
const OPERATIONAL_CAPABILITIES: Capability[] = [
  'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'checkin', 'placement',
  'moveGuests', 'assignOverflow', 'manageOverflow', 'manageMembers',
  'markNoShow', 'resolveExceptions',
];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: ALL_CAPABILITIES,
  // callStaff (appeler directement le staff/prestataires depuis /staff et
  // /plan-table) reserve a admin/directeur -- demande explicite de Gersom
  // le 23/08/2026 : "c'est au directeur de festin, les autres n'ont pas
  // besoin d'appeler les gens". Retire de OPERATIONAL_CAPABILITIES pour ne
  // pas le donner implicitement a placeur/agent_checkin.
  directeur: [...OPERATIONAL_CAPABILITIES, 'viewAllStaff', 'callStaff', 'manageTags', 'viewGuestApprovals', 'viewAgenda', 'manageAgenda', 'submitGuestApproval', 'reviewGuestApproval', 'assignGuestApproval'],
  placeur: [...OPERATIONAL_CAPABILITIES, 'viewGuestApprovals', 'submitGuestApproval', 'assignGuestApproval'],
  // Agent scan (entree/QR) : n'a pas manageTags -- la gestion des etiquettes
  // (cote, roles staff, notable...) est reservee a admin/directeur/placeur.
  // Conserve manageMembers (renommer, gerer les membres du groupe) : seule
  // la gestion des etiquettes a ete retiree, sur demande explicite de
  // Gersom le 23/08/2026 -- ce role est la pour scanner/checker, pas pour
  // reclassifier les invites.
  agent_checkin: [
    'scan', 'search', 'viewDashboard', 'viewTables', 'viewStaff', 'checkin',
    'assignOverflow', 'manageMembers', 'markNoShow',
    'resolveExceptions',
  ],
  visibilite: [
    'search', 'viewDashboard', 'viewTables', 'viewStaff', 'viewAllStaff',
    'viewGuestApprovals', 'reviewGuestApproval', 'assignGuestApproval',
  ],
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
// '/history' n'est plus dans ces listes (30/08/2026) : reserve a l'admin
// (role qui court-circuite ces prefixes plus haut, `if (role === 'admin')
// return true;`), plus dans le socle operationnel de directeur/placeur/
// agent_checkin. Un acces direct par URL est donc renvoye vers l'ecran par
// defaut du role, comme n'importe quel chemin hors matrice.
// '/approbations' est aussi ouvert a visibilite : ce role peut approuver ou
// refuser dans l'application, sans recevoir les autres droits operationnels.
const FULL_STAFF_PREFIXES = [
  '/scan', '/table', '/staff', '/checkin', '/search', '/dashboard', '/tables',
  '/plan-table', '/exceptions', '/placement', '/approbations', '/agenda', '/api',
];

const SCAN_STAFF_PREFIXES = [
  '/scan', '/table', '/staff', '/checkin', '/search', '/dashboard', '/tables',
  '/plan-table', '/exceptions', '/api',
];

const READ_ONLY_PREFIXES = ['/dashboard', '/tables', '/plan-table', '/staff', '/search', '/approbations', '/api'];

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

  // L'API /agenda gere aussi l'exception nominative `users.agenda_manager`
  // (Nelly conserve son role placeur). Elle reste l'autorite de lecture et
  // d'ecriture pour tous les comptes sans capacite de role.

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

