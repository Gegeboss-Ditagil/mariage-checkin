'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GuestRow, InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { TablePicker } from '@/components/TablePicker';
import { useOnline } from '@/hooks/useOnline';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';
import { debounce } from '@/lib/debounce';

// Deplace UNE personne nommee vers une autre table, separement du reste de
// son groupe -- demande de Gersom le 30/08/2026, apres l'ajout/renommage
// direct depuis la fiche (v1.23.0) : "ça va faciliter le transfert de
// personnes d'une table à une autre parce que maintenant on aura leurs
// noms". Meme structure que /tables/move/[invitationId] (deplacement du
// groupe entier), mais la personne est detachee dans une nouvelle invitation
// d'une seule personne a la table choisie (split_guest_to_new_invitation,
// migration 0031) -- pour la regrouper avec une invitation deja presente a
// la table cible, utiliser ensuite "Fusionner avec un autre groupe" depuis
// la nouvelle fiche (fonctionnalite existante, pas dupliquee ici).
export default function DeplacerGuestPage() {
  const { guestId } = useParams<{ guestId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [guest, setGuest] = useState<GuestRow | null>(null);
  const [sourceInvitation, setSourceInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentTable, setCurrentTable] = useState<TableRow | null>(null);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data: g } = await supabase.from('guests').select('*').eq('id', guestId).maybeSingle();
      if (!active) return;
      if (!g) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGuest(g as GuestRow);

      const { data: link } = await supabase
        .from('invitation_guests')
        .select('invitation_id, invitations(*)')
        .eq('guest_id', guestId)
        .maybeSingle();
      if (!active) return;
      const inv = (link as any)?.invitations as InvitationRow | undefined;
      if (!inv) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSourceInvitation(inv);

      const [{ data: tables }, { data: allInvs }, { data: assignments }] = await Promise.all([
        supabase.from('tables').select('*').order('is_reserve', { ascending: true }).order('number'),
        supabase.from('invitations').select('*'),
        supabase.from('overflow_assignments').select('*'),
      ]);
      if (!active) return;

      const tbls = (tables as TableRow[]) || [];
      setCurrentTable(tbls.find((t) => t.id === inv.table_id) || null);
      setUsages(
        computeTableCapacities(tbls, (allInvs as InvitationRow[]) || [], (assignments as OverflowAssignmentRow[]) || [])
      );
      setLoading(false);
    }

    load();

    const debouncedLoad = debounce(load, 400);
    const channel = supabase
      .channel('move-guest-' + guestId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, debouncedLoad)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [guestId]);

  async function handleMove() {
    if (!guest || !sourceInvitation || !chosenTableId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    const cible = usages.find((u) => u.table.id === chosenTableId);
    const confirmMsg =
      'Déplacer ' + guest.nom_affichage + ' seul(e) vers la table ' + (cible ? cible.table.number : '?') + ' ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: freshTable } = await supabase.from('tables').select('*').eq('id', chosenTableId).maybeSingle();
      if (!freshTable) {
        setError("Cette table n'existe plus — choisissez-en une autre");
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/members/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guest.id, table_id: chosenTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'member_not_found' || data.error === 'guest_not_found') {
          setError('Déjà déplacée par quelqu\'un d\'autre entre-temps — retour aux tables…');
          setTimeout(() => router.push('/tables'), 1200);
          return;
        }
        setError(
          data.error === 'table_not_found'
            ? 'Cette table n\'existe plus — choisissez-en une autre'
            : data.error || 'Échec du déplacement'
        );
        return;
      }
      const newInvitation = data.invitation as InvitationRow;
      router.push('/checkin/' + newInvitation.id);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Personne introuvable</p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading || !guest || !sourceInvitation) {
    // Garde le TopBar visible pendant le chargement (corrige le 03/09/2026,
    // retour de Gersom : "à chaque fois que je navigue... un flash, une
    // petite page qui apparaît") -- sans lui, l'en-tête apparaissait
    // brusquement une fois les donnees chargees, donnant l'impression d'un
    // flash entre deux pages differentes.
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Déplacer vers une table" backHref="/tables" />
        <p className="flex flex-1 items-center justify-center text-text-faint">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        title="Déplacer vers une table"
        backHref={sourceInvitation.id ? '/checkin/' + sourceInvitation.id : '/tables'}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="card">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">{guest.nom_affichage}</p>
          <p className="mt-1 text-text-muted">
            Actuellement dans « {sourceInvitation.nom_affichage} » ·{' '}
            {currentTable ? 'Table ' + currentTable.number : 'aucune table'}
          </p>
          <p className="mt-1 text-xs text-text-faint">
            Sera détaché(e) de ce groupe et deviendra une fiche à part à la table choisie — vous pourrez ensuite la
            fusionner avec une autre invitation déjà présente à cette table si besoin.
          </p>
        </div>

        <TablePicker
          usages={usages}
          excludeTableId={sourceInvitation.table_id}
          selectedTableId={chosenTableId}
          onSelect={setChosenTableId}
        />

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || submitting || !online}
          onClick={handleMove}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'DÉPLACER VERS CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}
