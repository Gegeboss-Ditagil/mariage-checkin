'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { CounterStepper } from '@/components/CounterStepper';
import { TopBar } from '@/components/TopBar';
import { proposeReserveTable, ReserveTableUsage } from '@/lib/overflow';
import { useOnline } from '@/hooks/useOnline';

type Step = 'confirm' | 'success' | 'success_retrait' | 'overflow' | 'overflow_done';

export default function CheckinPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();

  const online = useOnline();
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [arriveValue, setArriveValue] = useState(0);
  const [step, setStep] = useState<Step>('confirm');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState(0);

  const [excedentCount, setExcedentCount] = useState(0);
  const [reserveUsages, setReserveUsages] = useState<ReserveTableUsage[]>([]);
  const [chosenReserveTable, setChosenReserveTable] = useState<string | null>(null);
  const [existingAssignments, setExistingAssignments] = useState<
    { assignment: OverflowAssignmentRow; table: TableRow | null }[]
  >([]);

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
          setArriveValue(inv.nombre_arrive);
        } else {
          setNotFound(true);
        }
      });
  }, [invitationId]);

  const delta = invitation ? arriveValue - invitation.nombre_arrive : 0;

  async function loadAllTableUsages(): Promise<ReserveTableUsage[]> {
    const supabase = createClient();
    const [{ data: tables }, { data: assignments }, { data: allInvs }] = await Promise.all([
      supabase.from('tables').select('*').order('is_reserve', { ascending: false }).order('number'),
      supabase.from('overflow_assignments').select('reserve_table_id, nombre_personnes'),
      supabase.from('invitations').select('table_id, nombre_prevu'),
    ]);

    const overflowByTable = new Map<string, number>();
    (assignments || []).forEach((a: any) => {
      overflowByTable.set(a.reserve_table_id, (overflowByTable.get(a.reserve_table_id) || 0) + a.nombre_personnes);
    });

    const invByTable = new Map<string, number>();
    (allInvs || []).forEach((i: any) => {
      if (!i.table_id) return;
      invByTable.set(i.table_id, (invByTable.get(i.table_id) || 0) + i.nombre_prevu);
    });

    return ((tables as TableRow[]) || []).map((t) => {
      const used = (invByTable.get(t.id) || 0) + (overflowByTable.get(t.id) || 0);
      return { table: t, used, available: t.capacity - used };
    });
  }

  async function openOverflowFlow(totalExcedent: number) {
    if (!invitation) return;
    setExcedentCount(0);
    setChosenReserveTable(null);
    setExistingAssignments([]);

    const supabase = createClient();
    const [usages, { data: assignments }] = await Promise.all([
      loadAllTableUsages(),
      supabase
        .from('overflow_assignments')
        .select('*')
        .eq('invitation_id', invitation.id),
    ]);

    const tableById = new Map(usages.map((u) => [u.table.id, u.table]));
    const assigned = ((assignments as OverflowAssignmentRow[]) || []).map((a) => ({
      assignment: a,
      table: tableById.get(a.reserve_table_id) || null,
    }));
    const assignedSum = assigned.reduce((sum, a) => sum + a.assignment.nombre_personnes, 0);
    const remaining = Math.max(0, totalExcedent - assignedSum);

    setExistingAssignments(assigned);
    setReserveUsages(usages);
    setExcedentCount(remaining);
    if (remaining > 0) {
      const proposal = proposeReserveTable(usages, remaining);
      setChosenReserveTable(proposal?.table.id ?? null);
    }
    setStep('overflow');
  }

  async function handleAdd(nombrePersonnes: number) {
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
        body: JSON.stringify({ invitation_id: invitation.id, nombre_personnes: nombrePersonnes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la validation');
        return;
      }

      const updated = data.invitation as InvitationRow;
      setInvitation(updated);
      setArriveValue(updated.nombre_arrive);
      setLastDelta(nombrePersonnes);
      const exc = Math.max(0, updated.nombre_arrive - updated.nombre_prevu);

      if (exc > 0) {
        await openOverflowFlow(exc);
      } else {
        setStep('success');
      }
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(nouveauTotal: number) {
    if (!invitation) return;
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
        body: JSON.stringify({ invitation_id: invitation.id, nouveau_total: nouveauTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la correction');
        return;
      }

      const updated = data.invitation as InvitationRow;
      setLastDelta(invitation.nombre_arrive - updated.nombre_arrive);
      setInvitation(updated);
      setArriveValue(updated.nombre_arrive);
      setStep('success_retrait');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirm() {
    if (delta > 0) {
      handleAdd(delta);
    } else if (delta < 0) {
      handleRemove(arriveValue);
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

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-cream/80">Invitation introuvable</p>
        <p className="text-sm text-cream/50">Le lien utilisé ne correspond à aucune invitation.</p>
        <button className="btn-primary" onClick={() => router.push('/scan')}>
          Retour au scan
        </button>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-cream/50">Chargement…</div>
    );
  }

  if (step === 'success') {
    return (
      <SuccessScreen
        title="✓ ENTRÉE CONFIRMÉE"
        lines={[lastDelta + ' PERSONNE' + (lastDelta > 1 ? 'S' : '') + ' AJOUTÉE' + (lastDelta > 1 ? 'S' : '')]}
      />
    );
  }

  if (step === 'success_retrait') {
    return (
      <SuccessScreen
        title="✓ RETRAIT CONFIRMÉ"
        lines={[lastDelta + ' PERSONNE' + (lastDelta > 1 ? 'S' : '') + ' RETIRÉE' + (lastDelta > 1 ? 'S' : '')]}
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
        <TopBar title="Personnes supplémentaires" backHref={'/checkin/' + invitation.id} />
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="card border-2 border-status-over/30 bg-status-over/5">
            <p className="text-sm font-bold uppercase tracking-wide text-status-over">
              ⚠️ {invitation.nombre_arrive - invitation.nombre_prevu} personne
              {invitation.nombre_arrive - invitation.nombre_prevu > 1 ? 's' : ''} supplémentaire
              {invitation.nombre_arrive - invitation.nombre_prevu > 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-cream/60">
              Prévu : {invitation.nombre_prevu} · Présents : {invitation.nombre_arrive}
            </p>
          </div>

          {existingAssignments.length > 0 && (
            <div>
              <p className="mb-2 font-semibold text-cream">Déjà assigné</p>
              <div className="space-y-2">
                {existingAssignments.map(({ assignment, table }) => (
                  <button
                    key={assignment.id}
                    onClick={() => router.push('/tables/overflow/' + assignment.id)}
                    className="flex w-full items-center justify-between rounded-xl2 border-2 border-gold-400/20 bg-night-800 px-4 py-3 text-left text-cream"
                  >
                    <span className="font-semibold">
                      +{assignment.nombre_personnes} · {table ? 'Table ' + table.number : 'Table inconnue'}
                      {table?.is_reserve ? ' (réserve)' : ''}
                    </span>
                    <span className="text-xs text-gold-300 underline">Gérer</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {excedentCount > 0 && (
            <div>
              <p className="mb-2 font-semibold text-cream">
                Assigner {existingAssignments.length > 0 ? 'le reste (' + excedentCount + ')' : 'à une table'}
              </p>
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
                          ? 'border-cream/5 bg-cream/5 text-cream/30'
                          : selected
                          ? 'border-gold-400 bg-gold-400/10 text-cream'
                          : 'border-gold-400/20 bg-night-800 text-cream')
                      }
                    >
                      <span className="font-semibold">
                        Table {u.table.number}
                        {u.table.is_reserve ? ' (réserve)' : ''}
                      </span>
                      <span className="text-sm">
                        {full ? 'COMPLET' : u.used + ' / ' + u.table.capacity + ' places utilisees'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm font-medium text-status-over">{error}</p>}
        </div>

        <div className="space-y-3 px-4 pb-6">
          {excedentCount > 0 && (
            <button
              className="btn-primary w-full"
              disabled={!chosenReserveTable || submitting || !online}
              onClick={() => chosenReserveTable && handleAssignOverflow(chosenReserveTable)}
            >
              {submitting ? '…' : !online ? 'HORS LIGNE' : 'ASSIGNER LES ' + excedentCount + ' A CETTE TABLE'}
            </button>
          )}
          <button className="btn-secondary w-full" onClick={() => router.push('/checkin/' + invitation.id)}>
            {excedentCount > 0 ? 'NE PAS ASSIGNER MAINTENANT' : 'RETOUR'}
          </button>
        </div>
      </div>
    );
  }

  let boutonLabel = 'AUCUN CHANGEMENT';
  if (submitting) {
    boutonLabel = '…';
  } else if (!online) {
    boutonLabel = 'HORS LIGNE';
  } else if (delta > 0) {
    boutonLabel = 'CONFIRMER L’ENTRÉE (+' + delta + ')';
  } else if (delta < 0) {
    boutonLabel = 'CONFIRMER LE RETRAIT (' + delta + ')';
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={invitation.nom_affichage} backHref="/scan" />

      <div className="flex-1 px-4 py-6">
        <div className="card mb-4 space-y-1 text-center">
          <p className="text-sm uppercase tracking-wide text-cream/40">Personnes prévues</p>
          <p className="font-display text-4xl font-bold text-cream">{invitation.nombre_prevu}</p>
          <p className="text-sm text-cream/50">Actuellement enregistrées : {invitation.nombre_arrive}</p>
        </div>

        <button
          type="button"
          className="mb-3 block w-full text-center text-sm font-medium text-gold-300 underline underline-offset-2"
          onClick={() => router.push('/checkin/' + invitation.id + '/members')}
        >
          Gérer les membres du groupe (ajouter, retirer, nommer)
        </button>

        {invitation.nombre_arrive > invitation.nombre_prevu && (
          <button
            type="button"
            className="mb-6 block w-full text-center text-sm font-medium text-status-over underline underline-offset-2"
            onClick={() => openOverflowFlow(invitation.nombre_arrive - invitation.nombre_prevu)}
          >
            ⚠️ Gérer l’excédent ({invitation.nombre_arrive - invitation.nombre_prevu} personne
            {invitation.nombre_arrive - invitation.nombre_prevu > 1 ? 's' : ''})
          </button>
        )}

        <p className="mb-3 text-center font-semibold text-cream">Personnes arrivées</p>
        <CounterStepper value={arriveValue} min={0} max={30} onChange={setArriveValue} />

        {delta !== 0 && (
          <p className="mt-3 text-center text-sm font-medium text-gold-200">
            {delta > 0 ? '+' : ''}
            {delta} par rapport à maintenant
          </p>
        )}

        {arriveValue > invitation.nombre_prevu && (
          <p className="mt-3 text-center text-sm font-medium text-status-over">
            ⚠️ {arriveValue - invitation.nombre_prevu} personne{arriveValue - invitation.nombre_prevu > 1 ? 's' : ''} de plus que prévu
          </p>
        )}

        {error && <p className="mt-3 text-center text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="space-y-3 px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={delta === 0 || submitting || !online}
          onClick={handleConfirm}
        >
          {boutonLabel}
        </button>
      </div>
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
