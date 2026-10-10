import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

/**
 * v1.75.0 : contrôle de santé de la base (lecture seule, migration 0069,
 * app_health_report). Vérifie que chaque fonction SQL appelée par le code
 * existe en UNE seule version, que les colonnes attendues existent, et les
 * règles de données (lignes nominatives <= places, surcapacité, doublons...).
 * Réservé à l'admin (adminPanel).
 */
export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'adminPanel')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('app_health_report');
  if (error) {
    // La fonction elle-même manque : la migration 0069 n'est pas appliquée.
    return NextResponse.json(
      { checks: [{ check_name: 'fonction app_health_report', ok: false, detail: 'absente : appliquer la migration 0069' }] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
  return NextResponse.json({ checks: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}
