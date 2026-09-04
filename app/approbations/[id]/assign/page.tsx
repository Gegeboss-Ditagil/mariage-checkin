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

interface TargetRequest {
  id: string;
  nom_invite: string;
  nombre_invites: number;
  cote: 'Nelly' | 'Gege';
  statut: string;
  table_id: string | null;
  reserved_table_id: string | null;
  photo_signed_url: string | null;
}

/**
 * Deux modes selon l'état de la demande, même écran :
 * - "assign" (déjà APPROUVÉE) : crée l'invitation à la table choisie
 *   (RPC assign_table_to_guest_approval_strict, 0038) -- comportement
 *   d'origine, avec réorganisation possible si la table est trop pleine.
 * - "reserve" (encore EN ATTENTE) : réserve une table sans créer
 *   d'invitation (RPC reserve_table_for_guest_approval, 0044) -- demande de
 *   Gersom le 02/09/2026, "pour ne pas qu'on fasse du double booking" en
 *   attendant la décision. Finalisée automatiquement en vraie assignation
 *   dès l'approbation (lib/guestApprovalDecide.ts). Pas de réorganisation
 *   ici : trop tôt pour déplacer de vrais invités pour une demande pas
 *   encore décidée -- si la table choisie n'a plus assez de place, l'agent
 *   en choisit une autre.
 */
export default function AssignGuestApprovalTablePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useSessionRole();
  const online = useOnline();

  const [request, setRequest] = useState<TargetRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [relocationIds, setRelocationIds] = useState<string[]>([]);
  const [relocationTableId, setRelocationTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: 'assign' | 'reserve' = request?.statut === 'en_attente' ? 'reserve' : 'assign';

  // v1.41.0, retour de Gersom : « si j'approuve quelqu'un, il faut bien le
  // mettre quelque part ». Quand l'événement est plein, la liste vide
  // bloquait tout placement — un invité surprise approuvé doit pouvoir être
  // forcé sur la table choisie (une chaise de plus, comme lors d'un
  // déplacement 0008), jamais laissé sans table.
  const [force, setForce] = useState(false);
  const recommendations = useMemo(() => {
    const needed = request?.nombre_invites || 1;
    return usages
      .filter((usage) => force || usage.libresEstimees >= needed)
      .sort((a, b) => {
        const priority = (usage: TableCapacity) =>
          usage.libresEstimees >= needed ? (usage.table.number === 41 ? 0 : usage.table.is_reserve ? 1 : 2) : 3;
        return priority(a) - priority(b) || a.table.number - b.table.number;
      });
  }, [request?.nombre_invites, usages, force]);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch('/api/guest-approvals');
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        const found = (data.requests || []).find((r: TargetRequest) => r.id === id) || null;
        const eligible = !!found && !found.table_id && (found.statut === 'approuve' || found.statut === 'en_attente');
        if (!eligible) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRequest(found);
        // Réouverture sur une demande déjà réservée : pré-sélectionne sa
        // table actuelle, pour que "modifier" affiche l'état courant.
        if (found.statut === 'en_attente' && found.reserved_table_id) setChosenTableId(found.reserved_table_id);
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

  async function handleSubmit() {
    if (!chosenTableId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        '/api/guest-approvals/' + id + (mode === 'reserve' ? '/reserve-table' : '/assign-table'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'reserve'
              ? { table_id: chosenTableId }
              : {
                  table_id: chosenTableId,
                  relocations: relocationIds.map((invitation_id) => ({ invitation_id, destination_table_id: relocationTableId })),
                  force,
                }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'request_already_assigned'
            ? 'Déjà assignée entre-temps'
            : data.error === 'request_not_pending'
              ? 'Cette demande a déjà été décidée entre-temps — actualisez la liste.'
              : data.error?.includes('arrived_guest_cannot_move')
                ? 'Une personne sélectionnée est déjà arrivée et ne peut plus être déplacée.'
                : data.error?.includes('target_capacity_exceeded')
                  ? 'Table pleine — activez « Forcer le placement » pour asseoir l’invité quand même.'
                  : data.error?.includes('capacity_exceeded')
                    ? 'La capacité a changé entre-temps. Actualisez les tables et recommencez.'
                    : data.error || 'Échec de l\'opération'
        );
        setSubmitting(false);
        return;
      }
      router.push(mode === 'reserve' ? '/approbations' : '/checkin/' + data.invitation.id);
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
    // Garde le TopBar visible pendant le chargement (corrige le 03/09/2026,
    // retour de Gersom sur le flash de navigation). `mode` retombe sur
    // 'assign' tant que `request` n'est pas charge (voir sa definition
    // ci-dessus), donc ce meme titre par defaut reste coherent avec le
    // premier rendu une fois les donnees arrivees.
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title={mode === 'reserve' ? 'Réserver une table' : 'Assigner une table'} backHref="/approbations" />
        <p className="flex flex-1 items-center justify-center text-text-faint">Chargement…</p>
      </div>
    );
  }

  const targetUsage = usages.find((u) => u.table.id === chosenTableId) || null;
  const shortage = targetUsage ? Math.max(0, request.nombre_invites - targetUsage.libresEstimees) : 0;
  const targetOccupants = invitations.filter((inv) => inv.table_id === chosenTableId && !inv.ne_viendra_pas);
  const selectedRelocations = targetOccupants.filter((inv) => relocationIds.includes(inv.id));
  const seatsFreed = selectedRelocations.reduce((sum, inv) => sum + Math.max(inv.nombre_prevu, inv.nombre_arrive), 0);
  const relocationReady = mode === 'reserve' ? shortage === 0 : shortage === 0 || (!!relocationTableId && seatsFreed >= shortage);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar title={mode === 'reserve' ? 'Réserver une table' : 'Assigner une table'} backHref="/approbations" />

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
              {request.cote === 'Gege' ? 'Gégé' : 'Nelly'} · {mode === 'reserve' ? 'en attente de décision' : 'approuvé'}
            </p>
          </div>
        </div>

        {mode === 'reserve' && (
          <p className="rounded-2xl bg-accent-tint px-4 py-3 text-sm font-semibold text-accent">
            Cette place sera réservée pendant que la demande attend une décision — personne d’autre ne pourra la
            prendre entre-temps. Elle est confirmée automatiquement dès l’approbation.
          </p>
        )}

        <section className="card space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Tables disponibles</h2>
            <p className="text-sm text-text-muted">
              Seules les tables qui peuvent accueillir tout le groupe sont proposées. La table 41 est prioritaire lorsqu’elle a assez de places.
            </p>
          </div>
          {recommendations.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-status-partial">
                Aucune table n’a assez de places libres pour accueillir ce groupe (événement complet).
              </p>
              {mode === 'assign' && (
                <>
                  <p className="text-sm text-text-muted">
                    Vous pouvez quand même forcer le placement : l’invité sera assis sur la table choisie, avec une chaise ajoutée au-delà de sa
                    capacité (comme lors d’un déplacement).
                  </p>
                  <label className="flex items-start gap-3 rounded-xl2 border border-hairline bg-surface p-3">
                    <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-1 h-5 w-5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Forcer le placement sur une table pleine</span>
                      <span className="block text-xs text-text-muted">
                        Toutes les tables deviennent choisissables, même au-delà de leur capacité. Le dépassement est tracé dans l’audit.
                      </span>
                    </span>
                  </label>
                </>
              )}
            </div>
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

        {mode === 'assign' && chosenTableId && shortage > 0 && (
          <section className="card space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Libérer {shortage} place{shortage > 1 ? 's' : ''}</h2>
              <p className="text-sm text-text-muted">
                Cette table serait trop pleine. Choisissez au moins {shortage} place{shortage > 1 ? 's' : ''} parmi les invités non arrivés, puis leur nouvelle table.
              </p>
              {force && (
                <p className="text-sm text-text-muted">
                  En mode forcé, cette réorganisation est optionnelle : validez sans rien cocher pour asseoir l’invité au-delà de la capacité de la table.
                </p>
              )}
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

        {mode === 'reserve' && chosenTableId && shortage > 0 && (
          <p className="rounded-2xl bg-status-over/10 px-4 py-3 text-sm font-semibold text-status-over">
            Cette table n’a plus assez de places libres (capacité changée entre-temps) — choisissez-en une autre.
            La réorganisation d’invités déjà en place n’est proposée qu’après approbation.
          </p>
        )}

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || (mode === 'assign' && force ? false : !relocationReady) || submitting || !online}
          onClick={handleSubmit}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : mode === 'reserve' ? 'RÉSERVER CETTE TABLE' : 'ASSIGNER CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}
