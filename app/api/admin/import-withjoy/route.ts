import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { buildImportPlan, parseCsvText } from '@/lib/withjoyImport';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const csvText = typeof body.csvText === 'string' ? body.csvText : '';
  const mode = body.mode === 'confirm' ? 'confirm' : 'preview';
  if (!csvText.trim()) return NextResponse.json({ error: 'Fichier CSV vide ou illisible' }, { status: 400 });
  if (Buffer.byteLength(csvText, 'utf8') > MAX_CSV_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (maximum 5 Mo)' }, { status: 413 });
  }

  const plan = buildImportPlan(parseCsvText(csvText));
  if (!plan.report.ok) return NextResponse.json({ report: plan.report });

  const supabase = createAdminClient();
  const [{ data: event, error: eventError }, { data: state, error: stateError }] = await Promise.all([
    supabase.from('events').select('status').eq('id', user.event_id).single(),
    supabase.rpc('admin_import_invitations_state', { p_event_id: user.event_id }),
  ]);
  if (eventError || stateError || !state) {
    return NextResponse.json({ error: 'Impossible de vérifier l’état actuel avant import' }, { status: 500 });
  }

  if (mode === 'preview') {
    return NextResponse.json({
      report: plan.report,
      currentInvitationCount: state.count || 0,
      stateFingerprint: state.fingerprint,
    });
  }

  // L'import complet remet les arrivées et les membres à zéro. Il est donc
  // interdit en mode live/closed et exige une confirmation explicite.
  if (event.status !== 'setup' && event.status !== 'test') {
    return NextResponse.json({ error: "Import complet interdit lorsque l'événement est en mode live ou terminé" }, { status: 409 });
  }
  if (body.confirmation !== 'REMPLACER') {
    return NextResponse.json({ error: 'Confirmation explicite manquante' }, { status: 400 });
  }
  if (!Number.isInteger(body.expectedBeforeCount) || body.expectedBeforeCount < 0) {
    return NextResponse.json({ error: 'Aperçu expiré : recommencez l’analyse du fichier' }, { status: 409 });
  }
  if (typeof body.expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedFingerprint)) {
    return NextResponse.json({ error: 'Aperçu expiré : empreinte de sécurité manquante' }, { status: 409 });
  }
  if (plan.report.unplacedCount > 0 || plan.report.overCapacity.length > 0) {
    return NextResponse.json({ error: 'Import bloqué : des personnes ne peuvent pas être placées sans dépasser la capacité' }, { status: 409 });
  }

  const { data: tables, error: tablesError } = await supabase
    .from('tables')
    .select('id, number')
    .eq('event_id', user.event_id);
  if (tablesError) return NextResponse.json({ error: 'Impossible de lire les tables' }, { status: 500 });
  const tableIdByNumber = new Map((tables || []).map((table) => [table.number, table.id]));

  const missingTables = new Set<number>();
  const invitations = plan.tableAssignments.map(({ tableNumber, placementStatus, group }) => {
    const tableId = tableIdByNumber.get(tableNumber) || null;
    if (!tableId) missingTables.add(tableNumber);
    return {
      table_id: tableId,
      nom_affichage: group.label,
      groupe: group.groupe,
      nombre_prevu: group.size,
      telephone: group.phone || null,
      email: group.email || null,
      notes: group.notes,
      tags: group.tags,
      cote: group.cote,
      category: group.category,
      placement_status: placementStatus,
    };
  });
  for (const group of plan.sansTable) {
    invitations.push({
      table_id: null,
      nom_affichage: group.label,
      groupe: group.groupe,
      nombre_prevu: group.size,
      telephone: group.phone || null,
      email: group.email || null,
      notes: group.notes,
      tags: group.tags,
      cote: group.cote,
      category: group.category,
      // Meme regle que les invitations avec table (v1.19.0) : la confiance
      // RSVP pilote ce statut, plus le fait d'etre sans table.
      placement_status: group.rsvpConfirmed ? 'confirmee' : 'provisoire',
    });
  }
  if (missingTables.size) {
    return NextResponse.json({ error: `Tables introuvables : ${Array.from(missingTables).sort((a, b) => a - b).join(', ')}` }, { status: 409 });
  }

  const { data, error } = await supabase.rpc('admin_replace_invitations', {
    p_event_id: user.event_id,
    p_invitations: invitations,
    p_agent_id: user.id,
    p_expected_before_count: body.expectedBeforeCount,
    p_expected_fingerprint: body.expectedFingerprint,
  });
  if (error) {
    const stale = error.message.includes('import_source_changed');
    return NextResponse.json(
      { error: stale ? 'La liste a changé depuis l’aperçu : recommencez avant de confirmer' : "Échec atomique de l'import : " + error.message },
      { status: stale ? 409 : 500 }
    );
  }

  return NextResponse.json({ report: plan.report, result: data });
}
