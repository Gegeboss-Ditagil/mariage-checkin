'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { CounterStepper } from '@/components/CounterStepper';
import { TopBar } from '@/components/TopBar';
import { restants as computeRestants } from '@/lib/statusLogic';
import { proposeReserveTable, ReserveTableUsage } from '@/lib/overflow';
import { useOnline } from '@/hooks/useOnline';

type Step = 'confirm' | 'success' | 'overflow' | 'overflow_done';

export default function CheckinPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();

  const online = useOnline();
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [count, setCount] = useState(0);
  const [step, setStep] = useState<Step>('confirm');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [excedentCount, setExcedentCount] = useState(0);
  const [reserveUsages, setReserveUsages] = useState<ReserveTableUsage[]>([]);
  const [chosenReserveTable, setChosenReserveTable] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle()
      .then(({ data }) => {
        const inv = data as InvitationRow | null;
        setInvitation(inv);
        if (inv) {
          const rest = computeRestants(inv.nombre_prevu, inv.nombre_arrive);
          setCount(rest > 0 ? rest : 1);
        }
      });
  }, [invitationId]);

  const restants = useMemo(
    () => (invitation ? computeRestants(invitation.nombre_prevu, invitation.nombre_arrive) : 0),
    [invitation]
  );

  async function loadReserveUsages(): Promise<ReserveTableUsage[]> {
    const supabase = createClient();
    const [{ data: reserveTables }, { data: assignments }] = await Promise.all([
      supabase.from('tables').select('*').eq('is_reserve', true).order('number'),
      supabase.from('overflow_assignments').select('reserve_table_id, nombre_personnes'),
    ]);

    const usedByTable = new Map<string, number>();
    (assignments || []).forEach((a: any) => {
      usedByTable.set(a.reserve_table_id, (usedByTable.get(a.reserve_table_id) || 0) + a.nombre_personnes);
    });

    return ((reserveTables as TableRow[]) || []).map((t) => {
      const used = usedByTable.get(t.id) || 0;
      return { table: t, used, available: t.capacity - used };
    });
  }

  async function handleConfirm() {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, nombre_personnes: count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la validation');
        return;
      }

      const updated = data.invitation as InvitationRow;
      setInvitation(updated);
      const exc = Math.max(0, updated.nombre_arrive - updated.nombre_prevu);

      if (exc > 0) {
        setExcedentCount(exc);
        const usages = await loadReserveUsages();
        setReserveUsages(usages);
        const proposal = proposeReserveTable(usages, exc);
        setChosenReserveTable(proposal?.table.id ?? null);
        setStep('overflow');
      } else {
        setStep('success');
      }
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignOverflow(tableId: string) {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/overflow/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: invitation.id,
          reserve_table_id: tableId,
          nombre_personnes: excedentCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === 'reserve_table_full' ? 'Cette table est complète — choisissez-en une autre' : data.error);
        return;
      }
      setStep('overflow_done');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-black/50">Chargement…</div>
    );
  }

  if (step === 'success') {
    return (
      <SuccessScreen
        title="✓ ENTRÉE CONFIRMÉE"
        lines={[`${invitation.nombre_arrive} PERSONNE${invitation.nombre_arrive > 1 ? 'S' : ''}`]}
      />
    );
  }

  if (step === 'overflow_done') {
    return (
      <SuccessScreen
        title="✓ AFFECTATION CONFIRMÉE"
        lines={[`${excedentCount} personne${excedentCount > 1 ? 's' : ''} en table de réserve`]}
      />
    );
  }

  if (step === 'overflow') {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Personnes supplémentaires" />
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="card border-2 border-status-over/30 bg-status-over/5">
            <p className="text-sm font-bold uppercase tracking-wide text-status-over">
              ⚠️ {excedentCount} personne{excedentCount > 1 ? 's' : ''} supplémentaire{excedentCount > 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-black/60">
              Prévu : {invitation.nombre_prevu} · Présents : {invitation.nombre_arrive} · Excédent : +{excedentCount}
            </p>
          </div>

          <div>
            <p className="mb-2 font-semibold">Tables de réserve</p>
            <div className="space-y-2">
              {reserveUsages.map((u) => {
                const full = u.available < excedentCount;
                const selected = chosenReserveTable === u.table.id;
                return (
                  <button
                    key={u.table.id}
                    disabled={full}
                    onClick={() => setChosenReserveTable(u.table.id)}
                    className={`flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ${
                      full
                        ? 'border-black/5 bg-black/5 text-black/30'
                        : selected
                        ? 'border-ink bg-ink/5'
                        : 'border-black/10 bg-white'
                    }`}
                  >
                    <span className="font-semibold">Table {u.table.number}</span>
                    <span className="text-sm">
                      {full ? 'COMPLET' : `${u.used} / ${u.table.capacity} places utilisées`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm font-medium text-status-over">{error}</p>}
        </div>

        <div className="space-y-3 px-4 pb-6">
          <button
            className="btn-primary w-full"
            disabled={!chosenReserveTable || submitting || !online}
            onClick={() => chosenReserveTable && handleAssignOverflow(chosenReserveTable)}
          >
            {submitting ? '…' : !online ? 'HORS LIGNE' : `ASSIGNER LES ${excedentCount} À CETTE TABLE`}
          </button>
          <button className="btn-secondary w-full" onClick={() => router.push('/scan')}>
            NE PAS ASSIGNER MAINTENANT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={invitation.nom_affichage} backHref={invitation.table_id ?
