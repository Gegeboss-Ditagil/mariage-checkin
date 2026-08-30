// admin : acces total (Dos/Gersom).
// directeur : acces operationnel complet, sans panneau admin.
// placeur : acces operationnel complet.
// agent_checkin : scan/check-in, sans reorganisation apres coup.
// visibilite : lecture seule.
export type Role = 'admin' | 'directeur' | 'placeur' | 'agent_checkin' | 'visibilite';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  directeur: 'Directeur de festin',
  placeur: 'Agent placeur',
  agent_checkin: 'Agent scan',
  visibilite: 'Visibilité (lecture seule)',
};

export type InvitationStatut = 'non_arrive' | 'partiel' | 'complet' | 'excedent';

export interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  status: 'setup' | 'test' | 'live' | 'closed';
  reserve_table_capacity: number;
  created_at: string;
}

export interface TableRow {
  id: string;
  event_id: string;
  number: number;
  label: string | null;
  capacity: number;
  is_reserve: boolean;
  zone: string | null;
  created_at: string;
}

export type Cote = 'Nelly' | 'Gege' | 'Neutre';
export type PlacementStatus = 'confirmee' | 'provisoire' | 'provisoire_reserve';

export interface InvitationRow {
  id: string;
  event_id: string;
  table_id: string | null;
  nom_affichage: string;
  groupe: string | null;
  nombre_prevu: number;
  nombre_arrive: number;
  nombre_supplementaire: number;
  statut: InvitationStatut;
  category: string | null;
  notes: string | null;
  telephone: string | null;
  email: string | null;
  telephone_digits?: string | null;
  ne_viendra_pas: boolean;
  cote: Cote | null;
  tags: string[];
  placement_status: PlacementStatus;
  created_at: string;
  updated_at: string;
}

export const COTE_LABELS: Record<Cote, string> = {
  Nelly: 'Côté Nelly', Gege: 'Côté Gégé', Neutre: 'Neutre / prestataire',
};
export const COTE_DOT_COLORS: Record<Cote, string> = {
  Nelly: 'bg-nelly', Gege: 'bg-gege', Neutre: 'bg-black/30',
};
export const PLACEMENT_LABELS: Record<PlacementStatus, string> = {
  confirmee: 'Confirmée', provisoire: 'Provisoire', provisoire_reserve: 'Provisoire (réserve)',
};
export const PLACEMENT_COLORS: Record<PlacementStatus, string> = {
  confirmee: 'bg-status-complete/15 text-status-complete',
  provisoire: 'bg-status-partial/15 text-status-partial',
  provisoire_reserve: 'bg-status-partial/15 text-status-partial',
};

export type GuestArrivalStatus = 'attendu' | 'arrive' | 'ne_viendra_pas';

export interface GuestRow {
  id: string;
  event_id: string;
  nom: string | null;
  prenom: string | null;
  nom_affichage: string;
  telephone: string | null;
  email: string | null;
  vip: boolean;
  notes: string | null;
  created_at: string;
  arrival_status: GuestArrivalStatus;
}

export interface QrCodeRow {
  id: string;
  event_id: string;
  code: string;
  table_id: string;
  created_at: string;
}

export interface CheckinRow {
  id: string;
  event_id: string;
  invitation_id: string;
  agent_id: string | null;
  nombre_personnes: number;
  ancien_total: number;
  nouveau_total: number;
  is_correction: boolean;
  cancelled: boolean;
  created_at: string;
}

export interface OverflowAssignmentRow {
  id: string;
  event_id: string;
  invitation_id: string;
  origin_table_id: string | null;
  reserve_table_id: string;
  nombre_personnes: number;
  agent_id: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  event_id: string;
  nom_affichage: string;
  nom_complet: string | null;
  role: Role;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  event_id: string;
  action: string;
  invitation_id: string | null;
  table_id: string | null;
  agent_id: string | null;
  nombre_personnes: number | null;
  ancien_total: number | null;
  nouveau_total: number | null;
  origin_table_id: string | null;
  reserve_table_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  nom_affichage: string;
  nom_complet: string | null;
  role: Role;
  event_id: string;
}

export type GuestApprovalStatut = 'en_attente' | 'approuve' | 'refuse';

// Invité surprise avec approbation SMS à distance (v1.27.0) -- voir
// supabase/migrations/0032_guest_approvals.sql. `photo_url` est un CHEMIN
// dans le bucket privé 'guest-approval-photos', jamais une URL publique --
// toujours résolu en URL signée côté serveur avant d'être renvoyé à un
// client (lib/guestApprovalPhotos.ts).
export interface GuestApprovalRequestRow {
  id: string;
  event_id: string;
  token: string;
  requested_by: string | null;
  cote: Exclude<Cote, 'Neutre'>;
  nom_invite: string;
  nombre_invites: number;
  photo_url: string;
  approver_phone: string;
  statut: GuestApprovalStatut;
  decided_at: string | null;
  table_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  created_at: string;
}

export interface GuestApproverRow {
  cote: Exclude<Cote, 'Neutre'>;
  nom: string;
  telephone: string;
  updated_at: string;
}

export interface FestinDirectorRow {
  id: string;
  nom: string;
  telephone: string;
  created_at: string;
}

export const STATUS_LABELS: Record<InvitationStatut, string> = {
  non_arrive: 'Non arrivé',
  partiel: 'Partiellement arrivé',
  complet: 'Complet',
  excedent: 'Excédent',
};

export const STATUS_COLORS: Record<InvitationStatut, string> = {
  non_arrive: 'bg-status-none',
  partiel: 'bg-status-partial',
  complet: 'bg-status-complete',
  excedent: 'bg-status-over',
};



