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
        lines={[invitation.nombre_arrive + ' PERSONNE' + (invitation.nombre_arrive > 1 ? 'S' : '')]}
      />
    );
  }

  if (step === 'overflow_done') {
    return (
      <SuccessScreen
        title="✓ AFFECTATION CONFIRMÉE"
        lines={[excedentCount + ' personne' + (excedentCount > 1 ? 's' : '') + ' en table de reserve']}
      />
    );
  }

  if (step === 'overflow') {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Personnes supplémentaires" backHref="/scan" />
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
                    className={
                      'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                      (full
                        ? 'border-black/5 bg-black/5 text-black/30'
                        : selected
                        ? 'border-ink bg-ink/5'
                        : 'border-black/10 bg-white')
                    }
                  >
                    <span className="font-semibold">Table {u.table.number}</span>
                    <span className="text-sm">
                      {full ? 'COMPLET' : u.used + ' / ' + u.table.capacity + ' places utilisees'}
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
            {submitting ? '…' : !online ? 'HORS LIGNE' : 'ASSIGNER LES ' + excedentCount + ' A CETTE TABLE'}
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
      <TopBar title={invitation.nom_affichage} backHref="/scan" />

      <div className="flex-1 px-4 py-6">
        <div className="card mb-6 space-y-1 text-center">
          <p className="text-sm uppercase tracking-wide text-black/40">Personnes prévues</p>
          <p className="text-4xl font-bold">{invitation.nombre_prevu}</p>
          <p className="text-sm text-black/50">Déjà entrées : {invitation.nombre_arrive}</p>
          {restants > 0 && <p className="text-sm text-black/50">{restants} restante{restants > 1 ? 's' : ''}</p>}
        </div>

        <p className="mb-3 text-center font-semibold">Combien entrent maintenant ?</p>
        <CounterStepper value={count} min={1} max={30} onChange={setCount} />

        {count > restants && restants >= 0 && (
          <p className="mt-3 text-center text-sm font-medium text-status-over">
            ⚠️ {count - Math.max(restants, 0)} personne{count - restants > 1 ? 's' : ''} de plus que prévu
          </p>
        )}

        {error && <p className="mt-3 text-center text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="space-y-3 px-4 pb-6">
        <button className="btn-primary w-full" disabled={submitting || !online} onClick={handleConfirm}>
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'CONFIRMER L'ENTRÉE'}
        </button>
        <CorrectionControls
          invitationId={invitation.id}
          currentTotal={invitation.nombre_arrive}
          submitting={submitting}
          online={online}
          setSubmitting={setSubmitting}
          onUpdated={(inv) => setInvitation(inv)}
          setError={setError}
        />
      </div>
    </div>
  );
}

function CorrectionControls({
  invitationId,
  currentTotal,
  submitting,
  online,
  setSubmitting,
  onUpdated,
  setError,
}: {
  invitationId: string;
  currentTotal: number;
  submitting: boolean;
  online: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (inv: InvitationRow) => void;
  setError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentTotal);

  async function cancelLast() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkin/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      onUpdated(data.invitation);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function applyCorrection() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkin/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId, nouveau_total: value }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      onUpdated(data.invitation);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="w-full text-center text-sm font-semibold text-ink underline" onClick={() => setOpen(true)}>
        Ajouter / retirer une personne arrivée
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      {!online && <p className="text-center text-sm font-semibold text-status-over">HORS LIGNE — actions désactivées</p>}
      {currentTotal > 0 && (
        <button className="btn-secondary w-full" disabled={submitting || !online} onClick={cancelLast}>
          ANNULER LA DERNIÈRE ACTION
        </button>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full rounded-xl2 border border-black/10 px-3 py-2 text-lg"
          value={value}
          min={0}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <button className="btn-secondary shrink-0 px-4" disabled={submitting || !online} onClick={applyCorrection}>
          Corriger
        </button>
      </div>
      <button className="w-full text-center text-sm text-black/40" onClick={() => setOpen(false)}>
        Fermer
      </button>
    </div>
  );
}

function SuccessScreen({ title, lines }: { title: string; lines: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push('/scan'), 1800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-status-complete text-white">
      <p className="text-2xl font-bold">{title}</p>
      {lines.map((l) => (
        <p key={l} className="text-lg font-medium">
          {l}
        </p>
      ))}
      <button
        className="mt-6 rounded-xl2 border-2 border-white/70 px-6 py-2.5 text-sm font-semibold"
        onClick={() => router.push('/scan')}
      >
        Continuer →
      </button>
    </div>
  );
}
