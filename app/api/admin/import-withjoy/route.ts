import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { buildImportPlan, parseCsvText } from '@/lib/withjoyImport';
import { buildSafeMergePlan, type SafeMergePlan } from '@/lib/withjoySafeMerge';
import { logServerError } from '@/lib/serverLog';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const csvText = typeof body.csvText === 'string' ? body.csvText : '';
  const mode = body.mode === 'confirm' ? 'confirm' : body.mode === 'safe-apply' ? 'safe-apply' : 'preview';
  if (!csvText.trim()) return NextResponse.json({ error: 'Fichier CSV vide ou illisible' }, { status: 400 });
  if (Buffer.byteLength(csvText, 'utf8') > MAX_CSV_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (maximum 5 Mo)' }, { status: 413 });
  }

  const plan = buildImportPlan(parseCsvText(csvText));
  if (!plan.report.ok) return NextResponse.json({ report: plan.report });

  const supabase = createAdminClient();

  // v1.71.0 : « mise à jour sûre » (import de dernière minute, autorisé même
  // le jour J) -- calculée à CHAQUE aperçu et recalculée côté serveur avant
  // d'écrire : n'ajoute que les personnes absentes de la base, ne supprime
  // et ne remet jamais rien à zéro (voir lib/withjoySafeMerge.ts).
  const safe = await computeSafeMerge(supabase, user.event_id, plan);
  if ('error' in safe) return NextResponse.json({ error: safe.error }, { status: 500 });

  if (mode === 'safe-apply') {
    // L'aperçu affiché doit toujours correspondre à ce qui sera écrit : si
    // la base a changé entre-temps (quelqu'un a ajouté la même personne),
    // on refuse et on demande de relancer l'analyse.
    if (body.expectedAdditions !== safe.merge.additions.length) {
      return NextResponse.json({ error: 'La liste a changé depuis l’aperçu : relancez l’analyse du fichier' }, { status: 409 });
    }
    if (safe.merge.additions.length === 0) {
      return NextResponse.json({ result: { added: 0, persons: 0 } });
    }
    const rows = safe.merge.additions.map(({ group, tableNumber }) => ({
      event_id: user.event_id,
      table_id: tableNumber === null ? null : safe.tableIdByNumber.get(tableNumber) ?? null,
      nom_affichage: group.label,
      groupe: group.groupe,
      nombre_prevu: group.size,
      telephone: group.phone || null,
      email: group.email || null,
      notes: group.notes,
      tags: group.tags,
      cote: group.cote,
      category: group.category,
      placement_status: group.rsvpConfirmed ? 'confirmee' : 'provisoire',
      withjoy_party_id: group.withjoyPartyId,
    }));
    // Un seul INSERT multi-lignes : tout ou rien.
    const { error: insertError } = await supabase.from('invitations').insert(rows);
    if (insertError) {
      logServerError(insertError, { event_id: user.event_id, path: '/api/admin/import-withjoy', context: { mode: 'safe-apply' } });
      return NextResponse.json({ error: "Échec de l'ajout : " + insertError.message }, { status: 500 });
    }
    await supabase.from('audit_logs').insert({
      event_id: user.event_id,
      action: 'import_withjoy_safe_add',
      agent_id: user.id,
      details: {
        ajoutees: rows.length,
        personnes: safe.merge.addedPersons,
        invitations: safe.merge.additions.map(({ group, tableNumber }) => ({ nom: group.label, table: tableNumber })),
      },
    });
    return NextResponse.json({ result: { added: rows.length, persons: safe.merge.addedPersons } });
  }
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
      eventStatus: event.status,
      safe: {
        additions: safe.merge.additions.map(({ group, tableNumber, reason }) => ({
          label: group.label,
          size: group.size,
          tableNumber,
          reason,
        })),
        tableChanges: safe.merge.tableChanges,
        toReview: safe.merge.toReview,
        alreadyPresent: safe.merge.alreadyPresent,
        addedPersons: safe.merge.addedPersons,
      },
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
      withjoy_party_id: group.withjoyPartyId,
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
      withjoy_party_id: group.withjoyPartyId,
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
    if (!stale) {
      // Echec inattendu (pas le cas normal "aperçu perime") -- signale au
      // systeme de logs (voir lib/serverLog.ts) : c'est exactement le genre
      // d'incident a pouvoir relire apres coup pour diagnostiquer (ex.
      // v1.52.0, contrainte de cle etrangere manquante decouverte ainsi).
      logServerError(error, { event_id: user.event_id, path: '/api/admin/import-withjoy', context: { rpc: 'admin_replace_invitations' } });
    }
    return NextResponse.json(
      { error: stale ? 'La liste a changé depuis l’aperçu : recommencez avant de confirmer' : "Échec atomique de l'import : " + error.message },
      { status: stale ? 409 : 500 }
    );
  }

  return NextResponse.json({ report: plan.report, result: data });
}

// Lit l'état actuel (invitations + charge des tables actives) et calcule la
// « mise à jour sûre ». Les tables désactivées (capacité 0, ex. table 42)
// sont exclues : elles ne reçoivent jamais personne.
async function computeSafeMerge(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  plan: ReturnType<typeof buildImportPlan>
): Promise<{ merge: SafeMergePlan; tableIdByNumber: Map<number, string> } | { error: string }> {
  const [{ data: tables, error: tablesError }, { data: invitations, error: invitationsError }] = await Promise.all([
    supabase.from('tables').select('id, number, capacity').eq('event_id', eventId).gt('capacity', 0),
    supabase.from('invitations').select('id, nom_affichage, notes, withjoy_party_id, nombre_prevu, table_id').eq('event_id', eventId),
  ]);
  if (tablesError || invitationsError) return { error: 'Impossible de lire l’état actuel des invitations' };
  const numberById = new Map((tables || []).map((table) => [table.id as string, table.number as number]));
  const used = new Map<string, number>();
  for (const invitation of invitations || []) {
    if (invitation.table_id) used.set(invitation.table_id, (used.get(invitation.table_id) || 0) + (invitation.nombre_prevu || 0));
  }
  const merge = buildSafeMergePlan(
    plan,
    (invitations || []).map((invitation) => ({
      id: invitation.id,
      nom_affichage: invitation.nom_affichage,
      notes: invitation.notes,
      withjoy_party_id: invitation.withjoy_party_id,
      table_number: invitation.table_id ? numberById.get(invitation.table_id) ?? null : null,
    })),
    (tables || []).map((table) => ({ number: table.number, capacity: table.capacity, used: used.get(table.id) || 0 }))
  );
  return { merge, tableIdByNumber: new Map((tables || []).map((table) => [table.number as number, table.id as string])) };
}
