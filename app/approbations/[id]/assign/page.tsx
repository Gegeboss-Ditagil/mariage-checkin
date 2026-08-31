'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ table_id: chosenTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'request_already_assigned'
            ? 'Déjà assignée entre-temps'
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

        <TablePicker usages={usages} selectedTableId={chosenTableId} onSelect={setChosenTableId} />

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || submitting || !online}
          onClick={handleAssign}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'ASSIGNER CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}
