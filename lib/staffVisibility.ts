import type { InvitationRow, Role } from './types';

export function normalizeStaffTag(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

export function isStaffWithoutTable(invitation: Pick<InvitationRow, 'tags'>): boolean {
  return (invitation.tags || []).some((tag) => normalizeStaffTag(tag) === 'notable');
}

export function canViewAllStaff(role: Role): boolean {
  return role === 'admin' || role === 'directeur' || role === 'visibilite';
}

