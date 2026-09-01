'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow, PLACEMENT_LABELS, STATUS_LABELS } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { TablePicker } from '@/components/TablePicker';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useOnline } from '@/hooks/useOnline';
import { hasCapability } from '@/lib/permissions';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';

interface ApprovedRequest {
  id: string;
  nom_invite: string;
  nombre_invites: number;
  cote: 'Nelly' | 'Gege';
  statut: string;
  table_id: string | null;
  photo_signed_url: string | null;
}

/**
 * Assigne une table à une demande d'invité surprise déjà APPROUVÉE par SMS
 * -- même sélecteur de table (TablePicker, avec capacités en direct) que
 * /tables/move/[invitationId] et /tables/move-guest/[guestId], plutôt que le
 * formulaire libre de /tables/add (capacité addInvitation, réservée à
 * l'admin -- volontairement pas réutilisé ici, voir
 * app/api/guest-approvals/[id]/assign-table/route.ts).
 */
export default function AssignGuestApprovalTablePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useSessionRole();
  const online = useOnline();

  const [request, setRequest] = useState<ApprovedRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [relocationIds, setRelocationIds] = useState<string[]>([]);
  const [relocationTableId, setRelocationTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendations = useMemo(() => {
    const needed = request?.nombre_invites || 1;
    return usages
      .filter((usage) => usage.libresEstimees >= needed)
      .sort((a, b) => {
        const priority = (usage: TableCapacity) => usage.table.number === 41 ? 0 : usage.table.is_reserve ? 1 : 2;
        return priority(a) - priority(b) || a.table.number - b.table.number;
      });
  }, [request?.nombre_invites, usages]);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch('/api/guest-approvals');
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        const found = (data.requests || []).find((r: ApprovedRequest) => r.id === id) || null;
        if (!found || found.statut !== 'approuve' || found.table_id) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRequest(found);
      }

      const supabase = createClient();
      const [{ data: tables }, { data: invs }, { data: assignments }] = await Promise.all([
        supabase.from('tables').select('*').order('is_reserve', { ascending: true }).order('number'),
        supabase.from('invitations').select('*'),
        supabase.from('overflow_assignments').select('*'),
      ]);
      if (!active) return;
      setUsages(
        computeTableCapacities(
          (tables as TableRow[]) || [],
          (invs as InvitationRow[]) || [],
          (assignments as OverflowAssignmentRow[]) || []
        )
      );
      setInvitations((invs as InvitationRow[]) || []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  async function handleAssign() {
    if (!chosenTableId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/guest-approvals/' + id + '/assign-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: chosenTableId,
          relocations: relocationIds.map((invitation_id) => ({ invitation_id, destination_table_id: relocationTableId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'request_already_assigned'
            ? 'Déjà assignée entre-temps'
            : data.error?.includes('arrived_guest_cannot_move')
              ? 'Une personne sélectionnée est déjà arrivée et ne peut plus être déplacée.'
              : data.error?.includes('capacity_exceeded')
                ? 'La capacité a changé entre-temps. Actualisez les tables et recommencez.'
                : data.error || 'Échec de l\'assignation'
        );
        setSubmitting(false);
        return;
      }
      router.push('/checkin/' + data.invitation.id);
    } catch {
      setError('Erreur réseau — réessayez');
      setSubmitting(false);
    }
  }

  if (role && !hasCapability(role, 'assignGuestApproval')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <TopBar title="Assigner une table" backHref="/approbations" />
        <p className="mt-8 text-lg font-semibold">Accès réservé</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Demande introuvable ou déjà assignée</p>
        <button className="btn-primary" onClick={() => router.push('/approbations')}>
          Retour aux approbations
        </button>
      </div>
    );
  }

  if (loading || !request) {
    return <div className="flex min-h-dvh items-center justify-center text-text-faint">Chargement…</div>;
  }

  const targetUsage = usages.find((u) => u.table.id === chosenTableId) || null;
  const shortage = targetUsage ? Math.max(0, request.nombre_invites - targetUsage.libresEstimees) : 0;
  const targetOccupants = invitations.filter((inv) => inv.table_id === chosenTableId && !inv.ne_viendra_pas);
  const selectedRelocations = targetOccupants.filter((inv) => relocationIds.includes(inv.id));
  const seatsFreed = selectedRelocations.reduce((sum, inv) => sum + Math.max(inv.nombre_prevu, inv.nombre_arrive), 0);
  const relocationReady = shortage === 0 || (!!relocationTableId && seatsFreed >= shortage);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar title="Assigner une table" backHref="/approbations" />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="card flex items-center gap-3">
          {request.photo_signed_url && (
            <img
              src={request.photo_signed_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl2 border border-hairline object-cover"
            />
          )}
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-accent">{request.nom_invite}</p>
            <p className="text-sm text-text-muted">
              {request.nombre_invites} invité{request.nombre_invites > 1 ? 's' : ''} · Côté{' '}
              {request.cote === 'Gege' ? 'Gégé' : 'Nelly'} · approuvé
            </p>
          </div>
        </div>

        <section className="card space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Tables disponibles</h2>
            <p className="text-sm text-text-muted">
              Seules les tables qui peuvent accueillir tout le groupe sont proposées. La table 41 est prioritaire lorsqu’elle a assez de places.
            </p>
          </div>
          {recommendations.length === 0 ? (
            <p className="text-sm font-semibold text-status-partial">Aucune table n’a assez de places libres pour accueillir ce groupe.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recommendations.map((usage) => {
                return (
                  <button
                    key={usage.table.id}
                    type="button"
                    onClick={() => {
                      setChosenTableId(usage.table.id);
                      setRelocationIds([]);
                      setRelocationTableId(null);
                    }}
                    className={'rounded-xl2 border-2 px-4 py-3 text-left ' + (chosenTableId === usage.table.id ? 'border-accent bg-accent-tint' : 'border-hairline bg-surface')}
                  >
                    <span className="block font-semibold">Table {usage.table.number}{usage.table.label ? ` — ${usage.table.label}` : ''}</span>
                    <span className="block text-xs font-semibold text-status-complete">
                      {usage.libresEstimees} place{usage.libresEstimees > 1 ? 's' : ''} libre{usage.libresEstimees > 1 ? 's' : ''}{usage.table.is_reserve ? ' · réserve' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {chosenTableId && shortage > 0 && (
          <section className="card space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Libérer {shortage} place{shortage > 1 ? 's' : ''}</h2>
              <p className="text-sm text-text-muted">
                Cette table serait trop pleine. Choisissez au moins {shortage} place{shortage > 1 ? 's' : ''} parmi les invités non arrivés, puis leur nouvelle table.
              </p>
            </div>
            <div className="space-y-2">
              {targetOccupants.map((inv) => {
                const arrived = inv.nombre_arrive > 0;
                const checked = relocationIds.includes(inv.id);
                return (
                  <label key={inv.id} className={'flex items-start gap-3 rounded-xl2 border p-3 ' + (arrived ? 'border-hairline opacity-55' : 'border-hairline bg-surface')}>
                    <input
                      type="checkbox"
                      disabled={arrived}
                      checked={checked}
                      onChange={() => setRelocationIds((ids) => checked ? ids.filter((value) => value !== inv.id) : [...ids, inv.id])}
                      className="mt-1 h-5 w-5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{inv.nom_affichage} · {inv.nombre_prevu} place{inv.nombre_prevu > 1 ? 's' : ''}</span>
                      <span className="block text-xs text-text-muted">
                        {STATUS_LABELS[inv.statut]} · {PLACEMENT_LABELS[inv.placement_status]}
                        {arrived ? ' · Déjà arrivé/assis — déplacement interdit' : ' · Peut être déplacé'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className={seatsFreed >= shortage ? 'text-sm font-semibold text-status-complete' : 'text-sm font-semibold text-status-over'}>
              {seatsFreed} place{seatsFreed > 1 ? 's' : ''} libérée{seatsFreed > 1 ? 's' : ''} sur {shortage} requise{shortage > 1 ? 's' : ''}
            </p>
            {seatsFreed >= shortage && (
              <div className="space-y-2">
                <h3 className="font-semibold">Nouvelle table des personnes déplacées</h3>
                <TablePicker
                  usages={usages}
                  excludeTableId={chosenTableId}
                  selectedTableId={relocationTableId}
                  minimumEstimatedFree={seatsFreed}
                  onSelect={setRelocationTableId}
                />
              </div>
            )}
          </section>
        )}

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || !relocationReady || submitting || !online}
          onClick={handleAssign}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'ASSIGNER CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}
