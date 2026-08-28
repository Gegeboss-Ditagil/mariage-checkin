'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  COTE_DOT_COLORS,
  COTE_LABELS,
  Cote,
  InvitationRow,
  PLACEMENT_COLORS,
  PLACEMENT_LABELS,
  PlacementStatus,
  TableRow,
} from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { MessageButton } from '@/components/MessageButton';
import { FLOOR_PLAN_TABLE_POSITIONS, type Room, type TableCoteCounts } from '@/components/FloorPlan';
import { ZoomableFloorPlan } from '@/components/ZoomableFloorPlan';
import { debounce } from '@/lib/debounce';
import { extractPrenoms, extractMembresComplet } from '@/lib/membersNotes';
import clsx from 'clsx';

type Filtre = 'toutes' | PlacementStatus;
type Tri = 'numero' | 'libres';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  return 'Vol-' + (number <= 7 ? 'F' : 'T') + String(number).padStart(3, '0');
}

const PULL_THRESHOLD = 70;

// Cible actuelle (mise à jour le 21/08/2026) : 41 tables max (40 officielles
// + 1 seule réserve), donc 400 invités "officiels" — le reste (jusqu'à ce
// qu'on coupe la liste au prochain import) passe dans l'unique table de
// réserve, clairement marquée "excédentaire".
const CAPACITE_OFFICIELLE = 400;

export default function PlanTablePage() {
  const role = useSessionRole();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadInProgressRef = useRef(false);
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [query, setQuery] = useState('');
  const [tri, setTri] = useState<Tri>('numero');

  // -- Plan de salle interactif -----------------------------------------------
  // Replie par defaut (demande explicite de Gersom le 23/08/2026) : un
  // bouton dedie ouvre le plan plutot que de l'afficher en permanence en
  // haut d'une page deja longue. selectedTableId pilote a la fois le
  // surlignage sur le SVG et la carte "Table selectionnee" juste en dessous;
  // cliquer une table sur le plan OU le repere sur une carte plus bas met a
  // jour le meme etat, dans les deux sens.
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  // Zone staff selectionnee (Bar, Cuisine, DJ et animation, Prestataires...)
  // -- mutuellement exclusive avec selectedTableId : selectionner l'une
  // efface l'autre, un seul panneau s'affiche sous le plan a la fois.
  // Demande de Gersom le 23/08/2026 : cliquer une zone doit faire sortir le
  // personnel qui y est rattache (tag deja pose lors de l'import CSV).
  const [selectedZone, setSelectedZone] = useState<Room | null>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // -- Tire-pour-rafraichir (pull-to-refresh) --------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (loadInProgressRef.current) return;
    loadInProgressRef.current = true;
    const supabase = createClient();
    try {
      const [tablesResult, invitationsResult] = await Promise.all([
        supabase.from('tables').select('*').order('number'),
        supabase.from('invitations').select('*').order('nom_affichage'),
      ]);
      if (tablesResult.error || invitationsResult.error) {
        setLoadError("Impossible d'actualiser les tables. Vérifiez la connexion puis réessayez.");
        return;
      }
      setTables((tablesResult.data as TableRow[]) || []);
      setInvitations((invitationsResult.data as InvitationRow[]) || []);
      setLoadError(null);
    } catch {
      setLoadError("Impossible d'actualiser les tables. Vérifiez la connexion puis réessayez.");
    } finally {
      loadInProgressRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    load();
    // Realtime : toute nouvelle importation CSV met a jour cette page seule,
    // sans action de l'utilisateur (voir aussi le tire-pour-rafraichir ci-dessous).
    // `debounce` regroupe une rafale d'evenements (reimport CSV, correction
    // en lot) en un seul rechargement -- voir lib/debounce.ts.
    const debouncedLoad = debounce(load, 400);
    const channel = supabase
      .channel('plan-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, debouncedLoad)
      .subscribe();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const refreshWhenOnline = () => void load();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function doRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    setPull(0);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPull(Math.min(delta * 0.5, 110));
    }
  }

  function onTouchEnd() {
    if (touchStartY.current === null) return;
    if (pull > PULL_THRESHOLD) {
      doRefresh();
    } else {
      setPull(0);
    }
    touchStartY.current = null;
  }

  const invitationsByTable = useMemo(() => {
    const map = new Map<string, InvitationRow[]>();
    for (const inv of invitations) {
      if (!inv.table_id) continue;
      const list = map.get(inv.table_id) || [];
      list.push(inv);
      map.set(inv.table_id, list);
    }
    return map;
  }, [invitations]);

  const normales = tables.filter((t) => !t.is_reserve);
  const reserve = tables.filter((t) => t.is_reserve);
  const tablesVisibles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    let list = tables.filter((table) => {
      if (!normalized) return true;
      const invitationsTable = invitationsByTable.get(table.id) || [];
      return [String(table.number), table.label || '', table.zone || '', volCode(table.number) || '', ...invitationsTable.map((inv) => inv.nom_affichage), ...invitationsTable.flatMap((inv) => extractMembresComplet(inv.notes))]
        .some((value) => value.toLocaleLowerCase('fr').includes(normalized));
    });
    if (tri === 'libres') {
      list = [...list].sort((a, b) => {
        const occA = (invitationsByTable.get(a.id) || []).reduce((sum, inv) => sum + inv.nombre_prevu, 0);
        const occB = (invitationsByTable.get(b.id) || []).reduce((sum, inv) => sum + inv.nombre_prevu, 0);
        return (b.capacity - occB) - (a.capacity - occA) || a.number - b.number;
      });
    }
    return list;
  }, [tables, invitationsByTable, query, tri]);
  const normalesVisibles = tablesVisibles.filter((table) => !table.is_reserve);
  const reserveVisibles = tablesVisibles.filter((table) => table.is_reserve);

  const stats = useMemo(() => {
    const normalesIds = new Set(normales.map((t) => t.id));
    const reserveIds = new Set(reserve.map((t) => t.id));
    const totalPersonnes = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
    const parCote: Record<Cote, number> = { Nelly: 0, Gege: 0, Neutre: 0 };
    let confirmees = 0;
    let provisoires = 0;
    let officielles = 0;
    let excedentaire = 0;
    let sansTable = 0;
    for (const i of invitations) {
      if (i.cote) parCote[i.cote] += i.nombre_prevu;
      if (i.placement_status === 'confirmee') confirmees += i.nombre_prevu;
      else provisoires += i.nombre_prevu;
      // Sans table (staff "notable" volontairement accueilli hors placement,
      // voir /staff) n'est ni une place officielle ni un débordement en
      // réserve : les compter en excédentaire ferait croire à un problème de
      // capacité qui n'existe pas.
      if (i.table_id && normalesIds.has(i.table_id)) officielles += i.nombre_prevu;
      else if (i.table_id && reserveIds.has(i.table_id)) excedentaire += i.nombre_prevu;
      else sansTable += i.nombre_prevu;
    }
    return { totalPersonnes, parCote, confirmees, provisoires, officielles, excedentaire, sansTable };
  }, [invitations, normales, reserve]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;
  // Tables presentes sur le plan interactif -- 1 a 40 plus la reserve (41,
  // qui a desormais une position definie, voir FLOOR_PLAN_TABLE_POSITIONS).
  const tablesSurLePlan = new Set(Object.keys(FLOOR_PLAN_TABLE_POSITIONS).map(Number));
  const occupiedNumbers = new Set(
    tables.filter((t) => (invitationsByTable.get(t.id) || []).length > 0).map((t) => t.number)
  );

  // Recalcule la majorite Nelly/Gege de chaque table depuis les invitations
  // chargees. La couleur suit ainsi automatiquement les changements de
  // placement recus en temps reel.
  const coteByNumber = useMemo(() => {
    const map = new Map<number, TableCoteCounts>();
    for (const table of tables) {
      const counts: TableCoteCounts = { nelly: 0, gege: 0 };
      for (const invitation of invitationsByTable.get(table.id) || []) {
        if (invitation.cote === 'Nelly') counts.nelly += invitation.nombre_prevu;
        else if (invitation.cote === 'Gege') counts.gege += invitation.nombre_prevu;
      }
      map.set(table.number, counts);
    }
    return map;
  }, [tables, invitationsByTable]);

  // Personnel rattache a la zone selectionnee (tag deja present en base,
  // voir components/FloorPlan.tsx). Simple filtrage cote client sur les
  // invitations deja chargees -- aucun nouvel appel reseau.
  const selectedZoneTag = selectedZone?.staffTag ?? null;
  const staffForZone = selectedZoneTag
    ? invitations.filter((inv) => inv.category === 'Staff' && inv.tags.includes(selectedZoneTag))
    : [];
  const staffPeopleForZone = staffForZone.reduce((sum, inv) => sum + inv.nombre_prevu, 0);
  const sansTableInvitations = useMemo(() => invitations.filter((inv) => !inv.table_id), [invitations]);
  const sansTableVisibles = filtre === 'toutes'
    ? sansTableInvitations
    : sansTableInvitations.filter((inv) => inv.placement_status === filtre);

  function scrollToFloorPlan() {
    // requestAnimationFrame : laisse le temps au bloc de s'ouvrir (showFloorPlan)
    // avant de calculer sa position, sinon le scroll vise l'ancienne mise en page.
    requestAnimationFrame(() => {
      floorPlanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selectTableByNumber(number: number) {
    const table = tables.find((t) => t.number === number);
    if (!table) return; // Defensif : ne devrait pas arriver, seules les tables du plan sont cliquables.
    setSelectedTableId(table.id);
    setSelectedZone(null);
  }

  function selectZone(room: Room) {
    setSelectedZone(room);
    setSelectedTableId(null);
  }

  function locateOnPlan(table: TableRow) {
    if (!tablesSurLePlan.has(table.number)) return; // Table hors plan (pas encore positionnee).
    setSelectedTableId(table.id);
    setSelectedZone(null);
    setShowFloorPlan(true);
    scrollToFloorPlan();
  }

  // Comme sur /staff : tout le monde qui peut voir cet ecran voit le
  // personnel d'une zone, seuls ceux qui ont "checkin" peuvent toucher une
  // ligne pour aller la cocher. Le bouton d'appel reste reserve
  // admin/directeur (capacite callStaff), meme regle que sur /staff.
  const canCheckin = hasCapability(role, 'checkin');
  const canCall = hasCapability(role, 'callStaff');
  const canMessage = hasCapability(role, 'messageContacts');

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Plan de table"
        backHref={role && hasCapability(role, 'scan') ? '/scan' : '/dashboard'}
      />

      {/* Indicateur de tire-pour-rafraichir */}
      <div
        className="flex items-center justify-center overflow-hidden text-xs font-semibold text-gold-700 transition-[height]"
        style={{ height: refreshing ? 36 : pull }}
      >
        {refreshing ? 'Actualisation…' : pull > PULL_THRESHOLD ? 'Relâchez pour actualiser' : pull > 0 ? 'Tirez pour actualiser ↓' : null}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl2 bg-status-over/10 p-3 text-sm text-status-over">
            <span>{loadError}</span>
            <button type="button" className="shrink-0 font-semibold underline" onClick={() => void load()}>
              Réessayer
            </button>
          </div>
        )}
        {loading && <p className="py-8 text-center text-black/50">Chargement…</p>}

        {!loading && (
          <>
            {/* Plan de salle interactif : replie par defaut, un bouton
                dedie l'ouvre plutot que de l'imposer en haut d'une page
                deja longue (demande explicite de Gersom le 23/08/2026). */}
            <button
              type="button"
              className="btn-secondary mb-4 block w-full text-center"
              onClick={() => setShowFloorPlan((v) => !v)}
            >
              {showFloorPlan ? '🗺️ Masquer le plan de salle' : '🗺️ Voir le plan de salle'}
            </button>

            {showFloorPlan && (
              <div ref={floorPlanRef} className="mb-5">
                <ZoomableFloorPlan
                  selectedNumber={selectedTable?.number ?? null}
                  onSelectNumber={selectTableByNumber}
                  occupied={occupiedNumbers}
                  selectedZoneTag={selectedZoneTag}
                  onSelectZone={selectZone}
                  coteByNumber={coteByNumber}
                />
                <p className="mt-2 text-center text-xs text-black/40">
                  Appuyez sur une table pour la sélectionner, ou sur une zone en surbrillance (Bar, Cuisine, DJ et
                  animation, Prestataires) pour voir le personnel associé · pincez avec deux doigts (ou utilisez
                  +/−) pour zoomer.
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-black/50">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-nelly/25 ring-2 ring-nelly" /> majorité côté Nelly
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-gege/25 ring-2 ring-gege" /> majorité côté Gégé
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-black/10 ring-2 ring-black/30" /> égalité / neutre
                  </span>
                </div>

                {selectedTable && (
                  <div className="mt-3">
                    <TableCard
                      table={selectedTable}
                      invitations={invitationsByTable.get(selectedTable.id) || []}
                      filtre={filtre}
                      selected
                    />
                  </div>
                )}

                {selectedZone && (
                  <div className="card mt-3 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{selectedZone.label}</p>
                        {selectedZone.sub && <p className="truncate text-xs text-black/40">{selectedZone.sub}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">
                        {staffPeopleForZone} personne{staffPeopleForZone > 1 ? 's' : ''}
                      </span>
                    </div>

                    {staffForZone.length === 0 ? (
                      <p className="text-sm text-black/40">
                        Personne du staff n'est encore rattachée à cette zone pour l'instant.
                      </p>
                    ) : (
                      <ul className="divide-y divide-gold-400/10">
                        {staffForZone.map((inv) => {
                          const invTable = inv.table_id ? tables.find((t) => t.id === inv.table_id) : null;
                          const row = (
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{inv.nom_affichage}</p>
                              <p className="text-xs text-black/50">{invTable ? 'Table ' + invTable.number : 'Sans table'}</p>
                            </div>
                          );
                          return (
                            <li key={inv.id} className="flex items-center gap-2 py-2">
                              {canCheckin ? (
                                <Link href={'/checkin/' + inv.id} className="min-w-0 flex-1">
                                  {row}
                                </Link>
                              ) : (
                                row
                              )}
                              {canCall && inv.telephone && (
                                <a
                                  href={'tel:' + inv.telephone}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={'Appeler ' + inv.nom_affichage}
                                  className="shrink-0 rounded-full bg-gold-100 p-2 text-sm text-gold-700"
                                >
                                  📞
                                </a>
                              )}
                              {canMessage && inv.telephone && <MessageButton telephone={inv.telephone} name={inv.nom_affichage} compact />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="card py-3">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase text-black/45">Placement prévu</p><p className="font-bold">{stats.officielles}/{CAPACITE_OFFICIELLE}</p></div>
                <div className="mt-2 h-2 rounded-full bg-black/5"><div className="h-full rounded-full bg-gold-500" style={{ width: Math.min(100, (stats.officielles / CAPACITE_OFFICIELLE) * 100) + '%' }} /></div>
              </div>
              <div className="card py-3">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase text-black/45">Présence actuelle</p><p className="font-bold text-status-complete">{invitations.reduce((sum, inv) => sum + inv.nombre_arrive, 0)}/{stats.totalPersonnes}</p></div>
                <div className="mt-2 h-2 rounded-full bg-black/5"><div className="h-full rounded-full bg-status-complete" style={{ width: (stats.totalPersonnes ? Math.min(100, invitations.reduce((sum, inv) => sum + inv.nombre_arrive, 0) / stats.totalPersonnes * 100) : 0) + '%' }} /></div>
              </div>
            </div>

            {/* Stats compactes */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="card py-2">
                <p className="text-xl font-bold">{stats.totalPersonnes}</p>
                <p className="text-[11px] text-black/50">personnes</p>
              </div>
              <div className="card py-2">
                <p className="text-xl font-bold text-nelly">{stats.parCote.Nelly}</p>
                <p className="text-[11px] text-black/50">côté Nelly</p>
              </div>
              <div className="card py-2">
                <p className="text-xl font-bold text-gege">{stats.parCote.Gege}</p>
                <p className="text-[11px] text-black/50">côté Gégé</p>
              </div>
            </div>
            <div className="mb-5 grid grid-cols-2 gap-2 text-center">
              <div className="card py-2">
                <p className="text-lg font-bold text-status-complete">{stats.confirmees}</p>
                <p className="text-[11px] text-black/50">places confirmées</p>
              </div>
              <div className="card py-2">
                <p className="text-lg font-bold text-status-partial">{stats.provisoires}</p>
                <p className="text-[11px] text-black/50">places provisoires</p>
              </div>
            </div>

            {/* Capacite officielle : 40 tables x 10 = 400. Au-dela -> reserve/excedentaire. */}
            <div
              className={clsx(
                'card mb-5 flex items-center justify-between gap-3 py-3',
                stats.officielles > CAPACITE_OFFICIELLE && 'border-2 border-status-over/50'
              )}
            >
              <div>
                <p className="text-sm font-semibold">
                  {stats.officielles} / {CAPACITE_OFFICIELLE} places officielles (40 tables)
                </p>
                <p className="text-[11px] text-black/50">
                  {stats.excedentaire > 0
                    ? stats.excedentaire + ' personnes excédentaires actuellement en réserve — à couper au prochain import CSV'
                    : 'Sous la barre des 400, la réserve reste libre pour le jour J'}
                  {stats.sansTable > 0 &&
                    ' · ' + stats.sansTable + ' sans table (staff accueilli directement, voir /staff)'}
                </p>
              </div>
              {stats.officielles > CAPACITE_OFFICIELLE && (
                <span className="shrink-0 rounded-full bg-status-over/15 px-2.5 py-1 text-xs font-bold text-status-over">
                  Dépassé
                </span>
              )}
            </div>

            {/* Legende */}
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-black/50">
              <span className="flex items-center gap-1.5">
                <span className={clsx('h-2 w-2 rounded-full', COTE_DOT_COLORS.Nelly)} /> {COTE_LABELS.Nelly}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={clsx('h-2 w-2 rounded-full', COTE_DOT_COLORS.Gege)} /> {COTE_LABELS.Gege}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={clsx('h-2 w-2 rounded-full', COTE_DOT_COLORS.Neutre)} /> {COTE_LABELS.Neutre}
              </span>
            </div>

            <input aria-label="Rechercher une table, un vol ou un invité" className="mb-3 w-full rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3 placeholder:text-black/30 focus:border-gold-500 focus:outline-none" placeholder="Rechercher table, ville, vol ou invité…" value={query} onChange={(event) => setQuery(event.target.value)} />

            {/* Filtres */}
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {(['toutes', 'confirmee', 'provisoire'] as Filtre[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  className={clsx(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
                    filtre === f ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white text-black/50'
                  )}
                >
                  {f === 'toutes' ? 'Toutes les places' : PLACEMENT_LABELS[f]}
                </button>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTri('numero')} className={clsx('rounded-xl2 border-2 px-2 py-2 text-sm font-semibold', tri === 'numero' ? 'border-gold-500 bg-gold-400/10' : 'border-gold-300/30 bg-white text-black/60')}>Trier par numéro</button>
              <button type="button" onClick={() => setTri('libres')} className={clsx('rounded-xl2 border-2 px-2 py-2 text-sm font-semibold', tri === 'libres' ? 'border-gold-500 bg-gold-400/10' : 'border-gold-300/30 bg-white text-black/60')}>Trier par places libres</button>
            </div>

            {tablesVisibles.length === 0 && (
              <div className="card mb-6 py-6 text-center text-sm text-black/50">
                Aucune table ni invitation ne correspond à cette recherche.
              </div>
            )}

            {normalesVisibles.length > 0 && <p className="mb-2 text-sm font-semibold text-black/50">Tables familiales &amp; soirée</p>}
            <div className={clsx('grid grid-cols-1 gap-3 sm:grid-cols-2', normalesVisibles.length > 0 && 'mb-6')}>
              {normalesVisibles.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  invitations={invitationsByTable.get(t.id) || []}
                  filtre={filtre}
                  selected={selectedTableId === t.id}
                  onLocate={tablesSurLePlan.has(t.number) ? () => locateOnPlan(t) : undefined}
                />
              ))}
            </div>

            {reserveVisibles.length > 0 && <p className="mb-2 text-sm font-semibold text-black/50">
              Tables de réserve <span className="font-normal text-black/40">— excédentaire au-delà des 400</span>
            </p>}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {reserveVisibles.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  invitations={invitationsByTable.get(t.id) || []}
                  filtre={filtre}
                  reserve
                  selected={selectedTableId === t.id}
                  onLocate={tablesSurLePlan.has(t.number) ? () => locateOnPlan(t) : undefined}
                />
              ))}
            </div>

            {sansTableInvitations.length > 0 && (
              <>
                <p className="mb-2 text-sm font-semibold text-black/50">Sans table <span className="font-normal text-black/40">— staff accueilli directement</span></p>
                <div className="card p-4">
                  {sansTableVisibles.length === 0 ? <p className="text-xs italic text-black/40">Aucune place de ce type</p> : (
                    <ul className="divide-y divide-gold-400/10">
                      {sansTableVisibles.map((inv) => (
                        <li key={inv.id} className="flex items-center gap-2 py-2">
                          {canCheckin ? <Link href={'/checkin/' + inv.id} className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{inv.nom_affichage}</p><p className="text-xs text-black/50">{inv.tags.filter((tag) => tag !== 'SERVICES' && tag !== 'notable' && !tag.startsWith('Côté_')).join(' · ')}</p></Link> : <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{inv.nom_affichage}</p></div>}
                          {canMessage && inv.telephone && <MessageButton telephone={inv.telephone} name={inv.nom_affichage} compact />}
                          {canCall && inv.telephone && <a href={'tel:' + inv.telephone} aria-label={'Appeler ' + inv.nom_affichage} className="shrink-0 rounded-full bg-gold-100 p-2 text-sm text-gold-700">📞</a>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}

function TableCard({
  table,
  invitations,
  filtre,
  reserve,
  selected,
  onLocate,
}: {
  table: TableRow;
  invitations: InvitationRow[];
  filtre: Filtre;
  reserve?: boolean;
  // Table actuellement selectionnee sur le plan de salle interactif -- carte
  // encadree en vert, meme convention de couleur que le plan lui-meme.
  selected?: boolean;
  // Absent quand la table n'a pas d'emplacement sur le plan (reserve, ou
  // futur ajout hors plan) : bouton "localiser" masque plutot que desactive.
  onLocate?: () => void;
}) {
  const visibles = filtre === 'toutes' ? invitations : invitations.filter((i) => i.placement_status === filtre);
  const occ = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
  const arrives = invitations.reduce((s, i) => s + i.nombre_arrive, 0);
  const pct = Math.min(100, (occ / (table.capacity || 10)) * 100);
  const arrivalPct = occ > 0 ? Math.min(100, (arrives / occ) * 100) : 0;
  const vol = volCode(table.number);

  return (
    <div
      className={clsx(
        'card relative block',
        reserve && 'border-2 border-status-partial/40',
        selected && 'border-2 border-status-complete ring-2 ring-status-complete/30'
      )}
    >
      {onLocate && (
        <button
          type="button"
          aria-label={'Localiser la table ' + table.number + ' sur le plan de salle'}
          className="absolute right-2 top-2 rounded-full bg-gold-100 p-1.5 text-sm leading-none text-gold-700"
          onClick={onLocate}
        >
          📍
        </button>
      )}
      <Link href={'/tables/' + table.id} className="block">
        <div className="flex items-baseline justify-between gap-2 pr-8">
          <p className="font-display text-lg">
            Table {table.number}
            {table.label && <span className="ml-1.5 text-sm font-sans text-black/50">— {table.label}</span>}
            {reserve && (
              <span className="ml-1.5 rounded-full bg-status-over/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-over align-middle">
                Excédentaire
              </span>
            )}
          </p>
          <p className="shrink-0 text-xs tabular-nums text-black/40">
            {occ}/{table.capacity}
          </p>
        </div>
        {vol && <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">{vol}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/50">
          <span>{occ}/{table.capacity} places prévues</span>
          <span className="font-semibold text-status-complete">{arrives}/{occ} arrivées</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-black/5">
          <div className="h-full rounded-full bg-gold-500" style={{ width: pct + '%' }} />
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-black/5">
          <div className="h-full rounded-full bg-status-complete" style={{ width: arrivalPct + '%' }} />
        </div>

        {visibles.length === 0 && (
          <p className="mt-2 text-xs italic text-black/40">
            {invitations.length === 0 ? 'Libre pour le débordement du jour J' : 'Aucune place de ce type'}
          </p>
        )}

        <ul className="mt-2.5 space-y-1.5">
          {visibles.map((inv) => {
            const prenoms = extractPrenoms(inv.notes);
            return (
            <li key={inv.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span
                className={clsx('h-2 w-2 shrink-0 rounded-full', inv.cote ? COTE_DOT_COLORS[inv.cote] : 'bg-black/20')}
                title={inv.cote ? COTE_LABELS[inv.cote] : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{inv.nom_affichage}</span>
                {prenoms && <span className="block truncate text-xs font-medium text-gold-600">{prenoms}</span>}
              </span>
              {inv.category === 'Staff' && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                  Staff
                  <span
                    className={clsx('h-1.5 w-1.5 rounded-full', inv.cote ? COTE_DOT_COLORS[inv.cote] : 'bg-black/20')}
                  />
                </span>
              )}
              <span className="shrink-0 text-xs text-black/40">×{inv.nombre_prevu}</span>
              <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', inv.statut === 'complet' ? 'bg-status-complete/15 text-status-complete' : inv.statut === 'partiel' ? 'bg-status-partial/15 text-status-partial' : inv.statut === 'excedent' ? 'bg-status-over/15 text-status-over' : 'bg-black/5 text-black/45')}>
                {inv.statut === 'complet' ? 'Arrivé' : inv.statut === 'partiel' ? 'Partiel' : inv.statut === 'excedent' ? 'Excédent' : 'Non arrivé'}
              </span>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  PLACEMENT_COLORS[inv.placement_status]
                )}
              >
                {PLACEMENT_LABELS[inv.placement_status]}
              </span>
            </li>
            );
          })}
        </ul>
      </Link>
    </div>
  );
}
