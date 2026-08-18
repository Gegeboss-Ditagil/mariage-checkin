export type Role = 'admin' | 'agent_checkin' | 'placeur';

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
  created_at: string;
  updated_at: string;
}

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
