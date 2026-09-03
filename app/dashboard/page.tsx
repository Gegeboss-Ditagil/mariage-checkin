'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { CapacityGauge } from '@/components/CapacityGauge';
import { AddInvitationButton } from '@/components/AddInvitationButton';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { debounce } from '@/lib/debounce';
import { applyRowDelta } from '@/lib/realtimeDelta';

export default function DashboardPage() {
  const role = useSessionRole();
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);
  const activeRef = useRef(true);

  // `load` sert à la fois au chargement initial, au temps réel (websocket)
  // et au rafraîchissement manuel (tirer vers le bas / retour sur l'écran)
  // — un seul et même code, pour ne jamais afficher deux logiques
  // différentes qui pourraient diverger.
  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: invs }, { data: tbls }, { data: ov }] = await Promise.all([
      supabase.from('invitations').select('*'),
      supabase.from('tables').select('*').order('number'),
      supabase.from('overflow_assignments').select('*'),
    ]);
    if (!activeRef.current) return;
    setInvitations((invs as InvitationRow[]) || []);
    setTables((tbls as TableRow[]) || []);
    setOverflow((ov as OverflowAssignmentRow[]) || []);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    const supabase = createClient();

    load();

    // Le chemin chaud (chaque check-in = UPDATE d'une invitation) est applique
    // LOCALEMENT via le payload Realtime (~1 Ko) au lieu d'un rechargement
    // complet de ~100-300 Ko sur chaque tablette ouverte. INSERT/DELETE (rare :
    // reimport CSV, corrections en lot) restent debounces -- voir lib/debounce.ts.
    const debouncedLoad = debounce(load, 400);
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'invitations' }, (payload) =>
        setInvitations((prev) => applyRowDelta(prev, payload))
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invitations' }, debouncedLoad)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'invitations' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, debouncedLoad)
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

  const stats = useMemo(() => {
    const attendus = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
    const arrives = invitations.reduce((s, i) => s + i.nombre_arrive, 0);
    const restants = Math.max(0, attendus - arrives);
    const taux = attendus > 0 ? (arrives / attendus) * 100 : 0;

    return {
      attendus,
      arrives,
      restants,
      taux,
      tablesCompletes: invitations.filter((i) => i.statut === 'complet').length,
      tablesPartielles: invitations.filter((i) => i.statut === 'partiel').length,
      nonArrives: invitations.filter((i) => i.statut === 'non_arrive').length,
      supplementaires: invitations.reduce((s, i) => s + Math.max(0, i.nombre_arrive - i.nombre_prevu), 0),
    };
  }, [invitations]);

  const staffInvitations = invitations.filter((i) => i.category === 'Staff');
  const staffPrevu = staffInvitations.reduce((s, i) => s + i.nombre_prevu, 0);
  const staffArrive = staffInvitations.reduce((s, i) => s + i.nombre_arrive, 0);
  const canSeeStaffSection = hasCapability(role, 'viewAllStaff');

  const reserveTables = tables.filter((t) => t.is_reserve);
  const usageByTable = new Map<string, number>();
  overflow.forEach((o) => usageByTable.set(o.reserve_table_id, (usageByTable.get(o.reserve_table_id) || 0) + o.nombre_personnes));
  const capaciteOfficielle = tables.filter((t) => !t.is_reserve).reduce((s, t) => s + t.capacity, 0);
  const capaciteTotale = tables.reduce((s, t) => s + t.capacity, 0);
  const remplissageSalle = capaciteTotale > 0 ? (stats.arrives / capaciteTotale) * 100 : 0;
  // Marque sur la jauge la limite des places officielles (400) dans une
  // jauge graduee sur la capacite totale (400 + reserve) : au-dela de cette
  // marque, on est dans la reserve, pas dans la capacite normale de la salle.
  const seuilOfficielPct = capaciteTotale > 0 ? (capaciteOfficielle / capaciteTotale) * 100 : undefined;

  function voir(type: string) {
    router.push('/dashboard/liste?type=' + type);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title="Tableau de bord"
          // Retour direct vers /scan des que le role peut scanner (admin et
          // directeur inclus) -- corrige le 02/09/2026 : la cible precedente
          // ('/') repassait par la SplashScreen, qui renvoie elle-meme vers
          // /dashboard pour le directeur (aller-retour visible, "page
          // passeport bleu" signalee par Remy) et vers /scan pour l'admin
          // apres un flash inutile. visibilite (sans capacite scan) n'a
          // toujours pas de fleche retour ici : le tableau de bord est deja
          // son ecran d'accueil.
          backHref={role && hasCapability(role, 'scan') ? '/scan' : undefined}
          // "+ Invité" ajouté ici aussi le 02/09/2026 (demande de Gersom) --
          // même bouton, même emplacement (coin supérieur droit, à côté du
          // menu du compte) que sur /plan-table, réservé à addInvitation
          // (admin/directeur uniquement).
          right={<AddInvitationButton role={role} />}
        />

        <PullToRefreshIndicator
          pulling={pulling}
          pullDistance={pullDistance}
          refreshing={refreshing}
          pullThreshold={pullThreshold}
        />

        {/* Densite resserree le 02/09/2026 (retour de Gersom : "trop
            d'informations, il faut scroll down... pour que tout rentre dans
            la page") -- l'empilement complet (jauge + 2 grilles de stats +
            Staff + reserve) depassait la hauteur d'un iPhone meme apres le
            pb-10 du 02/09/2026 precedent qui ne visait que la derniere carte.
            Espacements et cartes resserres (space-y-6->4, gap-3->2, cartes en
            py-2.5, valeurs en text-3xl) plutot qu'un padding de bas de page :
            le contenu entier doit tenir sans scroll, pas juste finir proprement
            apres un scroll. */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-6">
          <div className="card py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Remplissage de la salle</p>
              <p className="text-xs text-text-faint">
                {stats.arrives} / {capaciteOfficielle}
                {capaciteTotale > capaciteOfficielle && ' (+' + (capaciteTotale - capaciteOfficielle) + ' réserve)'}
              </p>
            </div>
            <CapacityGauge percent={remplissageSalle} size="lg" warningAt={seuilOfficielPct} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Invités attendus" value={stats.attendus} onClick={() => voir('tous')} />
            <StatTile
              label="Arrivés"
              value={stats.arrives}
              accent="text-status-complete"
              onClick={() => voir('arrives')}
            />
            <StatTile
              label="Restants"
              value={stats.restants}
              accent="text-status-partial"
              onClick={() => voir('restants')}
            />
            <StatTile label="Taux d'arrivée" value={stats.taux.toFixed(1) + '%'} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <MiniStat label="Complètes" value={stats.tablesCompletes} color="bg-status-complete" onClick={() => voir('complet')} />
            <MiniStat label="Partielles" value={stats.tablesPartielles} color="bg-status-partial" onClick={() => voir('partiel')} />
            <MiniStat label="Non arrivées" value={stats.nonArrives} color="bg-status-none" onClick={() => voir('non_arrive')} />
            <MiniStat
              label="Supplémentaires"
              value={stats.supplementaires}
              color="bg-status-over"
              onClick={() => voir('supplementaire')}
            />
          </div>

          <div>
            {/* En-tete combine (maquette Atrium/Maison) : Staff et Tables de
                reserve vivaient dans deux blocs separes avec un titre normal
                -- regroupes sous un seul intitule uppercase, comme les autres
                en-tetes de section de la maquette (ex: "Placement & presence"
                sur /plan-table), accent en Maison. Le libelle s'adapte si
                Staff n'est pas visible pour ce role (canSeeStaffSection). */}
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-faint dark:text-accent">
              {canSeeStaffSection ? 'Staff & réserve' : 'Tables de réserve'}
            </p>
            {canSeeStaffSection && (
              <button
                type="button"
                onClick={() => router.push('/staff')}
                className="card mb-1.5 flex w-full items-center justify-between py-2.5 text-left active:scale-[0.98] transition-transform"
              >
                <span className="font-semibold">Staff</span>
                <span className="text-text-muted">
                  {staffArrive} / {staffPrevu} arrivés
                </span>
              </button>
            )}
            <div className="space-y-1.5">
              {reserveTables.map((t) => {
                const used = usageByTable.get(t.id) || 0;
                const full = used >= t.capacity;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => router.push('/tables/' + t.id)}
                    className="card flex w-full items-center justify-between py-2.5 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="font-semibold">Table {t.number}</span>
                    <span className={full ? 'font-bold text-status-over' : 'text-text-muted'}>
                      {full ? 'COMPLET' : used + ' / ' + t.capacity + ' places utilisées'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
      {role && <BottomNav role={role} />}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: number | string;
  accent?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-xs uppercase tracking-wide text-text-faint">{label}</p>
      <p className={'mt-0.5 text-3xl font-bold tabular-nums ' + (accent || '')}>{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="card py-3 w-full text-center active:scale-[0.98] transition-transform">
        {content}
      </button>
    );
  }

  return <div className="card py-3 text-center">{content}</div>;
}

function MiniStat({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center gap-2">
        <span className={'h-2.5 w-2.5 rounded-full ' + color} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-xl2 bg-surface p-2.5 text-left shadow-card active:scale-[0.98] transition-transform"
      >
        {content}
      </button>
    );
  }

  return <div className="flex items-center justify-between rounded-xl2 bg-surface p-2.5 shadow-card">{content}</div>;
}


