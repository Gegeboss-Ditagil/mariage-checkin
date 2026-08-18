import { createAdminClient } from '@/lib/supabase/admin';

export type ExportType = 'arrives' | 'absents' | 'partiels' | 'supplementaires' | 'repartition' | 'reserve';

export interface ExportSheet {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

const STATUT_LABELS: Record<string, string> = {
  non_arrive: 'Non arrivé',
  partiel: 'Partiel',
  complet: 'Complet',
  excedent: 'Excédent',
};

/**
 * Construit les lignes d'export pour un type donne. Toute la logique de
 * regroupement vit ici, independamment du format de sortie (CSV / XLSX).
 */
export async function buildExport(eventId: string, type: ExportType): Promise<ExportSheet> {
  const supabase = createAdminClient();

  if (type === 'arrives' || type === 'absents' || type === 'partiels') {
    const { data: invitations } = await supabase
      .from('invitations')
      .select('nom_affichage, groupe, category, nombre_prevu, nombre_arrive, nombre_supplementaire, statut, table_id')
      .eq('event_id', eventId)
      .order('nom_affichage');
    const { data: tables } = await supabase.from('tables').select('id, number, label').eq('event_id', eventId);
    const tableById = new Map((tables || []).map((t) => [t.id, t]));

    const filtered = (invitations || []).filter((inv) => {
      if (type === 'arrives') return inv.nombre_arrive > 0;
      if (type === 'absents') return inv.nombre_arrive === 0;
      return inv.statut === 'partiel';
    });

    const headers =
      type === 'partiels'
        ? ['Nom', 'Groupe', 'Catégorie', 'Table', 'Prévu', 'Arrivé', 'Manquants', 'Statut']
        : ['Nom', 'Groupe', 'Catégorie', 'Table', 'Prévu', 'Arrivé', 'Statut'];

    const rows = filtered.map((inv) => {
      const table = inv.table_id ? tableById.get(inv.table_id) : null;
      const tableLabel = table ? `${table.number}${table.label ? ' — ' + table.label : ''}` : '—';
      const base = [
        inv.nom_affichage,
        inv.groupe || '',
        inv.category || '',
        tableLabel,
        inv.nombre_prevu,
        inv.nombre_arrive,
      ];
      if (type === 'partiels') base.push(Math.max(inv.nombre_prevu - inv.nombre_arrive, 0));
      base.push(STATUT_LABELS[inv.statut] || inv.statut);
      return base;
    });

    const filenames: Record<string, string> = {
      arrives: 'invites_arrives',
      absents: 'invites_absents',
      partiels: 'invites_partiels',
    };

    return { filename: filenames[type], headers, rows };
  }

  if (type === 'supplementaires') {
    const { data: overflow } = await supabase
      .from('overflow_assignments')
      .select('nombre_personnes, created_at, invitation_id, origin_table_id, reserve_table_id')
      .eq('event_id', eventId)
      .order('created_at');
    const { data: invitations } = await supabase
      .from('invitations')
      .select('id, nom_affichage, groupe')
      .eq('event_id', eventId);
    const { data: tables } = await supabase.from('tables').select('id, number, label').eq('event_id', eventId);

    const invById = new Map((invitations || []).map((i) => [i.id, i]));
    const tableById = new Map((tables || []).map((t) => [t.id, t]));

    const rows = (overflow || []).map((o) => {
      const inv = invById.get(o.invitation_id);
      const origin = o.origin_table_id ? tableById.get(o.origin_table_id) : null;
      const reserve = tableById.get(o.reserve_table_id);
      return [
        inv?.nom_affichage || '',
        inv?.groupe || '',
        origin ? `${origin.number}${origin.label ? ' — ' + origin.label : ''}` : '—',
        reserve ? `${reserve.number}${reserve.label ? ' — ' + reserve.label : ''}` : '—',
        o.nombre_personnes,
      ];
    });

    return {
      filename: 'personnes_supplementaires',
      headers: ['Nom', 'Groupe', 'Table d\'origine', 'Table de réserve', 'Nb personnes'],
      rows,
    };
  }

  if (type === 'repartition') {
    const { data: tables } = await supabase
      .from('tables')
      .select('id, number, label, capacity, is_reserve')
      .eq('event_id', eventId)
      .order('number');
    const { data: invitations } = await supabase
      .from('invitations')
      .select('table_id, nombre_arrive')
      .eq('event_id', eventId);
    const { data: overflow } = await supabase
      .from('overflow_assignments')
      .select('reserve_table_id, nombre_personnes')
      .eq('event_id', eventId);

    const arrivesParTable = new Map<string, number>();
    for (const inv of invitations || []) {
      if (!inv.table_id) continue;
      arrivesParTable.set(inv.table_id, (arrivesParTable.get(inv.table_id) || 0) + (inv.nombre_arrive || 0));
    }
    for (const o of overflow || []) {
      arrivesParTable.set(o.reserve_table_id, (arrivesParTable.get(o.reserve_table_id) || 0) + o.nombre_personnes);
    }

    const rows = (tables || []).map((t) => {
      const arrives = arrivesParTable.get(t.id) || 0;
      return [
        t.number,
        t.label || '',
        t.is_reserve ? 'Réserve' : 'Normale',
        t.capacity,
        arrives,
        Math.max(t.capacity - arrives, 0),
      ];
    });

    return {
      filename: 'repartition_finale_tables',
      headers: ['Table', 'Libellé', 'Type', 'Capacité', 'Personnes présentes', 'Places restantes'],
      rows,
    };
  }

  // reserve
  const { data: reserveTables } = await supabase
    .from('tables')
    .select('id, number, label, capacity')
    .eq('event_id', eventId)
    .eq('is_reserve', true)
    .order('number');
  const { data: overflow } = await supabase
    .from('overflow_assignments')
    .select('reserve_table_id, nombre_personnes, invitation_id, origin_table_id, created_at')
    .eq('event_id', eventId);
  const { data: invitations } = await supabase.from('invitations').select('id, nom_affichage').eq('event_id', eventId);
  const { data: allTables } = await supabase.from('tables').select('id, number, label').eq('event_id', eventId);

  const invById = new Map((invitations || []).map((i) => [i.id, i]));
  const tableById = new Map((allTables || []).map((t) => [t.id, t]));

  const rows: (string | number)[][] = [];
  for (const rt of reserveTables || []) {
    const assignments = (overflow || []).filter((o) => o.reserve_table_id === rt.id);
    const used = assignments.reduce((sum, a) => sum + a.nombre_personnes, 0);
    if (assignments.length === 0) {
      rows.push([rt.number, rt.label || '', rt.capacity, 0, rt.capacity, '', '', '']);
      continue;
    }
    for (const a of assignments) {
      const inv = invById.get(a.invitation_id);
      const origin = a.origin_table_id ? tableById.get(a.origin_table_id) : null;
      rows.push([
        rt.number,
        rt.label || '',
        rt.capacity,
        used,
        Math.max(rt.capacity - used, 0),
        inv?.nom_affichage || '',
        origin ? `${origin.number}${origin.label ? ' — ' + origin.label : ''}` : '—',
        a.nombre_personnes,
      ]);
    }
  }

  return {
    filename: 'utilisation_tables_reserve',
    headers: ['Table réserve', 'Libellé', 'Capacité', 'Occupées', 'Places restantes', 'Invité affecté', 'Table d\'origine', 'Nb personnes'],
    rows,
  };
}
