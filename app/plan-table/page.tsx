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
import { FLOOR_PLAN_TABLE_POSITIONS } from '@/components/FloorPlan';
import { ZoomableFloorPlan } from '@/components/ZoomableFloorPlan';
import clsx from 'clsx';

type Filtre = 'toutes' | PlacementStatus;

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
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  // -- Plan de salle interactif -----------------------------------------------
  // Replie par defaut (demande explicite de Gersom le 23/08/2026) : un
  // bouton dedie ouvre le plan plutot que de l'afficher en permanence en
  // haut d'une page deja longue. selectedTableId pilote a la fois le
  // surlignage sur le SVG et la carte "Table selectionnee" juste en dessous;
  // cliquer une table sur le plan OU le repere sur une carte plus bas met a
  // jour le meme etat, dans les deux sens.
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // -- Tire-pour-rafraichir (pull-to-refresh) --------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: t }, { data: i }] = await Promise.all([
      supabase.from('tables').select('*').order('number'),
      supabase.from('invitations').select('*').order('nom_affichage'),
    ]);
    setTables((t as TableRow[]) || []);
    setInvitations((i as InvitationRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    load();
    // Realtime : toute nouvelle importation CSV met a jour cette page seule,
    // sans action de l'utilisateur (voir aussi le tire-pour-rafraichir ci-dessous).
    const channel = supabase
      .channel('plan-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, load)
      .subscribe();
    return () => {
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
  // Uniquement les tables 1-40 : le plan ne connait pas encore la table de
  // reserve (41), sans emplacement physique defini (voir Gersom le
  // 23/08/2026) -- FLOOR_PLAN_TABLE_POSITIONS n'a d'entree que pour celles-la.
  const tablesSurLePlan = new Set(Object.keys(FLOOR_PLAN_TABLE_POSITIONS).map(Number));
  const occupiedNumbers = new Set(
    normales.filter((t) => (invitationsByTable.get(t.id) || []).length > 0).map((t) => t.number)
  );

  function scrollToFloorPlan() {
    // requestAnimationFrame : laisse le temps au bloc de s'ouvrir (showFloorPlan)
    // avant de calculer sa position, sinon le scroll vise l'ancienne mise en page.
    requestAnimationFrame(() => {
      floorPlanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selectTableByNumber(number: number) {
    const table = tables.find((t) => t.number === number && !t.is_reserve);
    if (!table) return; // Defensif : ne devrait pas arriver, seules 1-40 sont sur le plan.
    setSelectedTableId(table.id);
  }

  function locateOnPlan(table: TableRow) {
    if (!tablesSurLePlan.has(table.number)) return; // Reserve ou table hors plan.
    setSelectedTableId(table.id);
    setShowFloorPlan(true);
    scrollToFloorPlan();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Plan de table"
        backHref={role && hasCapability(role, 'scan') ? '/scan' : '/tables'}
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
                />
                <p className="mt-2 text-center text-xs text-black/40">
                  Appuyez sur une table pour la sélectionner · pincez avec deux doigts (ou utilisez +/−) pour zoomer.
                </p>

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
              </div>
            )}

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

            <p className="mb-2 text-sm font-semibold text-black/50">Tables familiales &amp; soirée</p>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {normales.map((t) => (
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

            <p className="mb-2 text-sm font-semibold text-black/50">
              Tables de réserve <span className="font-normal text-black/40">— excédentaire au-delà des 400</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {reserve.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  invitations={invitationsByTable.get(t.id) || []}
                  filtre={filtre}
                  reserve
                />
              ))}
            </div>
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
  const pct = Math.min(100, (occ / (table.capacity || 10)) * 100);

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
        <div className="mt-1.5 h-1.5 rounded-full bg-black/5">
          <div className="h-full rounded-full bg-gold-500" style={{ width: pct + '%' }} />
        </div>

        {visibles.length === 0 && (
          <p className="mt-2 text-xs italic text-black/40">
            {invitations.length === 0 ? 'Libre pour le débordement du jour J' : 'Aucune place de ce type'}
          </p>
        )}

        <ul className="mt-2.5 space-y-1.5">
          {visibles.map((inv) => (
            <li key={inv.id} className="flex items-center gap-1.5 text-sm">
              <span
                className={clsx('h-2 w-2 shrink-0 rounded-full', inv.cote ? COTE_DOT_COLORS[inv.cote] : 'bg-black/20')}
                title={inv.cote ? COTE_LABELS[inv.cote] : undefined}
              />
              <span className="min-w-0 flex-1 truncate">{inv.nom_affichage}</span>
              {inv.category === 'Staff' && (
                <span className="flex shrink-0 items-center gap-1 rounded bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                  Staff
                  <span
                    className={clsx('h-1.5 w-1.5 rounded-full', inv.cote ? COTE_DOT_COLORS[inv.cote] : 'bg-black/20')}
                  />
                </span>
              )}
              <span className="shrink-0 text-xs text-black/40">×{inv.nombre_prevu}</span>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  PLACEMENT_COLORS[inv.placement_status]
                )}
              >
                {PLACEMENT_LABELS[inv.placement_status]}
              </span>
            </li>
          ))}
        </ul>
      </Link>
    </div>
  );
}
