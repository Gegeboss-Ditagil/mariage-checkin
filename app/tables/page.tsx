'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';
import { CapacityGauge } from '@/components/CapacityGauge';
import { hasCapability } from '@/lib/permissions';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';

type Tri = 'numero' | 'libres';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

export default function TablesPage() {
  const role = useSessionRole();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);
  const [query, setQuery] = useState('');
  // "libres" met en avant les tables avec le plus de places probablement
  // libres en ce moment -- c'est la vue d'ensemble qui repond directement a
  // "ou puis-je placer un excedent maintenant ?" sans ouvrir chaque table
  // une par une.
  const [tri, setTri] = useState<Tri>('numero');
  const activeRef = useRef(true);

  // `load` sert au chargement initial, au temps réel (websocket) et au
  // rafraîchissement manuel (tirer vers le bas / retour sur l'écran) —
  // un seul et même code partout.
  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: t }, { data: i }, { data: o }] = await Promise.all([
      supabase.from('tables').select('*').order('number'),
      supabase.from('invitations').select('*'),
      supabase.from('overflow_assignments').select('*'),
    ]);
    if (!activeRef.current) return;
    setTables((t as TableRow[]) || []);
    setInvitations((i as InvitationRow[]) || []);
    setOverflow((o as OverflowAssignmentRow[]) || []);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    const supabase = createClient();

    load();
    const channel = supabase
      .channel('tables-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, load)
      .subscribe();

    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Filet de sécurité si le websocket temps réel s'est endormi (téléphone
  // verrouillé, app en arrière-plan) : tirer vers le bas, ou simplement
  // revenir sur cet écran, relance un refetch rapide.
  const { pulling, pullDistance, refreshing, pullThreshold } = usePullToRefresh(load);

  const capacities = useMemo(
    () => computeTableCapacities(tables, invitations, overflow),
    [tables, invitations, overflow]
  );
  const capacityById = useMemo(() => new Map(capacities.map((c) => [c.table.id, c])), [capacities]);

  const totaux = useMemo(() => {
    return capacities.reduce(
      (acc, c) => ({
        capacite: acc.capacite + c.table.capacity,
        arrivees: acc.arrivees + c.arrivees,
        libresMaintenant: acc.libresMaintenant + c.libresMaintenant,
        libresEstimees: acc.libresEstimees + c.libresEstimees,
      }),
      { capacite: 0, arrivees: 0, libresMaintenant: 0, libresEstimees: 0 }
    );
  }, [capacities]);

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tables;
    if (q) {
      list = list.filter((t) => {
        const vol = volCode(t.number) || '';
        return (
          String(t.number).includes(q) ||
          (t.label || '').toLowerCase().includes(q) ||
          (t.zone || '').toLowerCase().includes(q) ||
          vol.toLowerCase().includes(q)
        );
      });
    }
    if (tri === 'libres') {
      list = [...list].sort((a, b) => {
        const ca = capacityById.get(a.id);
        const cb = capacityById.get(b.id);
        return (cb?.libresMaintenant || 0) - (ca?.libresMaintenant || 0);
      });
    }
    return list;
  }, [tables, query, tri, capacityById]);

  const normales = filteredTables.filter((t) => !t.is_reserve);
  const reserve = filteredTables.filter((t) => t.is_reserve);

  function TableCard({ t }: { t: TableRow; key?: string }) {
    const c = capacityById.get(t.id);
    const vol = volCode(t.number);
    return (
      <Link
        href={'/tables/' + t.id}
        className={'card' + (t.is_reserve ? ' border-2 border-status-partial/40' : '')}
      >
        <p className="font-display text-lg font-bold ">Table {t.number}</p>
        {t.label && <p className="truncate text-xs text-black/40">{t.label}</p>}
        {t.is_reserve && !t.label && <p className="text-xs text-black/40">Réserve</p>}
        {vol && <p className="truncate text-xs text-black/30">{vol}</p>}
        {c && (
          <>
            <p className="mt-1 text-sm text-black/60">
              {c.arrivees}/{t.capacity} arrivés
            </p>
            <p
              className={
                'text-xs font-semibold ' + (c.libresMaintenant > 0 ? 'text-status-complete' : 'text-black/40')
              }
            >
              {c.libresMaintenant} libre{c.libresMaintenant > 1 ? 's' : ''} maintenant
            </p>
            <CapacityGauge percent={(c.arrivees / t.capacity) * 100} size="sm" showLabel={false} />
          </>
        )}
      </Link>
    );
  }

  const canAddInvitation = hasCapability(role, 'addInvitation');

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Tables"
        right={
          <div className="flex items-center gap-2">
            <Link href="/plan-table" className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
              Plan de table
            </Link>
            {canAddInvitation && (
            <Link
              href="/tables/add"
              aria-label="Ajouter un invité"
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400/40 bg-gold-400/10 text-xl font-bold leading-none text-gold-600"
            >
              +
            </Link>
            )}
          </div>
        }
      />

      <PullToRefreshIndicator
        pulling={pulling}
        pullDistance={pullDistance}
        refreshing={refreshing}
        pullThreshold={pullThreshold}
      />

      <div className="flex-1 px-4 py-4">
        <div className="card mb-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs uppercase text-black/40">Capacité</p>
            <p className="text-xl font-bold ">{totaux.capacite}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-black/40">Arrivés</p>
            <p className="text-xl font-bold text-status-complete">{totaux.arrivees}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-black/40">Libres maintenant</p>
            <p className="text-xl font-bold text-gold-600">{totaux.libresMaintenant}</p>
          </div>
        </div>
        <div className="card mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold ">Remplissage global</p>
          </div>
          <CapacityGauge percent={totaux.capacite > 0 ? (totaux.arrivees / totaux.capacite) * 100 : 0} />
        </div>
        <p className="mb-4 text-center text-xs text-black/40">
          Estimation si tous les invités encore attendus se présentent : {totaux.libresEstimees} places libres.
        </p>

        {/* Le bouton "Placement" a ete retire de la barre de navigation du bas
            (doublon avec Scan + Recherche), mais son ecran (scan QR ou
            recherche -> gros numero de table affiche, pratique pour
            renseigner un invite rapidement) reste entierement disponible
            ici, depuis la section Tables. */}
        <Link href="/placement" className="btn-secondary mb-4 block w-full text-center">
          Trouver la table d'un invité (scan QR ou recherche)
        </Link>

        <input
          className="mb-3 w-full rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3  placeholder:text-black/30 focus:border-gold-500 focus:outline-none"
          placeholder="Rechercher une table (numéro, ville, vol…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTri('numero')}
            className={
              'flex-1 rounded-xl2 border-2 py-2 text-sm font-semibold ' +
              (tri === 'numero'
                ? 'border-gold-500 bg-gold-400/10 '
                : 'border-gold-300/30 bg-white text-black/60')
            }
          >
            Trier par numéro
          </button>
          <button
            type="button"
            onClick={() => setTri('libres')}
            className={
              'flex-1 rounded-xl2 border-2 py-2 text-sm font-semibold ' +
              (tri === 'libres'
                ? 'border-gold-500 bg-gold-400/10 '
                : 'border-gold-300/30 bg-white text-black/60')
            }
          >
            Trier par places libres
          </button>
        </div>

        {filteredTables.length === 0 && (
          <p className="py-6 text-center text-black/50">Aucune table pour « {query} »</p>
        )}

        {tri === 'libres' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredTables.map((t) => (
              <TableCard key={t.id} t={t} />
            ))}
          </div>
        ) : (
          <>
            {normales.length > 0 && (
              <>
                <p className="mb-2 text-sm font-semibold text-black/50">Tables normales</p>
                <div className="mb-6 grid grid-cols-2 gap-3">
                  {normales.map((t) => (
                    <TableCard key={t.id} t={t} />
                  ))}
                </div>
              </>
            )}

            {reserve.length > 0 && (
              <>
                <p className="mb-2 text-sm font-semibold text-black/50">Tables de réserve</p>
                <div className="grid grid-cols-2 gap-3">
                  {reserve.map((t) => (
                    <TableCard key={t.id} t={t} />
                  ))}
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



