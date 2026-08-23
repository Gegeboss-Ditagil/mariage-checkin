import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/permissions';
import { isStaffWithoutTable } from '@/lib/staffVisibility';
import type { InvitationRow, TableRow } from '@/lib/types';

interface StaffInvitation extends InvitationRow {
  table?: TableRow | null;
}

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'viewStaff')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('invitations')
    .select('*, table:tables(*)')
    .eq('category', 'Staff')
    .order('nom_affichage');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const staff = (data as StaffInvitation[] | null) || [];
  const visibleStaff = hasCapability(user.role, 'viewAllStaff') ? staff : staff.filter(isStaffWithoutTable);

  return NextResponse.json(
    { invitations: visibleStaff },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
