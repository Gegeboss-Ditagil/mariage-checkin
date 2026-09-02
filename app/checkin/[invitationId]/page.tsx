'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow, PLACEMENT_LABELS } from '@/lib/types';
import { CounterStepper } from '@/components/CounterStepper';
import { TopBar } from '@/components/TopBar';
import { proposeReserveTable } from '@/lib/overflow';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';
import { useOnline } from '@/hooks/useOnline';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { ETIQUETTES_RAPIDES, libelleEtiquette } from '@/lib/tags';
import { GuestArrivalPanel } from '@/components/GuestArrivalPanel';
import { GuestApprovalCaptureFlow } from '@/components/GuestApprovalCaptureFlow';

type Step = 'confirm' | 'success' | 'success_retrait' | 'overflow' | 'overflow_done';

export default function CheckinPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();

  const online = useOnline();
  const role = useSessionRole();
  const canReorganizeExcedent = hasCapability(role, 'manageOverflow');
  const canRename = hasCapability(role, 'manageMembers');
  const canMoveGuest = hasCapability(role, 'moveGuests');
  const canManageTags = hasCapability(role, 'manageTags');
  const canMerge = hasCapability(role, 'mergeInvitations');
  // Invite surprise lie a ce groupe -- reserve a submitGuestApproval, jamais
  // agent_checkin, meme regle que /scan et que "Invite supplementaire (non
  // prevu)" (resserre le 02/09/2026, voir app/api/members/add-unplanned) :
  // "les scanners ne vont même pas traiter votre demande... les placeurs
  // vont gérer le reste, car ils auront les bons accès".
  const canSubmitGuestApproval = hasCapability(role, 'submitGuestApproval');
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Valeur affichee par le compteur +/- : represente directement le nombre
  // de personnes arrivees (pas un nombre a ajouter). Initialisee au nombre
  // deja enregistre, puis modifiee avec + ou - avant de confirmer.
  const [arriveValue, setArriveValue] = useState(0);
  const [step, setStep] = useState<Step>('confirm');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // excedentCount = la part de l'excedent PAS ENCORE assignee a une table
  // (ce qu'on propose d'assigner maintenant). existingAssignments = ce qui a
  // deja ete assigne lors d'une visite precedente sur ce meme groupe — evite
  // d'assigner deux fois le meme excedent si on rouvre cet ecran plus tard.
  const [excedentCount, setExcedentCount] = useState(0);
  const [reserveUsages, setReserveUsages] = useState<TableCapacity[]>([]);
  const [chosenReserveTable, setChosenReserveTable] = useState<string | null>(null);
  const [existingAssignments, setExistingAssignments] = useState<
    { assignment: OverflowAssignmentRow; table: TableRow | null }[]
  >([]);
  const [confirmFullTable, setConfirmFullTable] = useState(false);
  // Table a laquelle appartient cette invitation, pour l'afficher directement
  // sur la fiche (utile pour informer l'invite retrouve via une recherche
  // telephone/email de sa table, sans avoir a naviguer ailleurs).
  const [invitationTable, setInvitationTable] = useState<TableRow | null>(null);
  const invitationTableIdRef = useRef<string | null>(null);
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  // Vrai des que GuestArrivalPanel affiche reellement une liste de membres.
  // Part de true (optimiste) : la plupart des invitations ouvertes ici sont
  // des groupes, donc pas de flash vers l'ancien compteur pendant le
  // premier chargement. Corrige par le panneau lui-meme une fois les
  // membres charges -- ne JAMAIS le deduire de nombre_prevu (qui baisse des
  // qu'une personne passe en "ne_viendra_pas" : un groupe de 2 tombe a
  // nombre_prevu=1 des la premiere exclusion, ce qui faisait disparaitre le
  // panneau -- et la personne exclue avec, plus aucun moyen de l'annuler --
  // trouve par Gersom le 29/08/2026).
  const [hasMemberList, setHasMemberList] = useState(true);

  // -- Renommer l'invitation (pas un membre detaille -- voir /members) ------
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // -- Etiquettes (cote, staff, sans table, role prestataire) --------------
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');

  // -- Invite imprevu ("+ Invite supplementaire") -- ajout NOMME depuis
  // v1.23.0 (demande de Gersom le 30/08/2026) : ne touche jamais
  // nombre_prevu (add_unplanned_arrival, migration 0030), pour continuer a
  // declencher l'assignation de table de reserve en cas de depassement,
  // comme le faisait l'ancien "+1" anonyme.
  const [addingUnplanned, setAddingUnplanned] = useState(false);
  const [unplannedPrenom, setUnplannedPrenom] = useState('');
  const [unplannedNom, setUnplannedNom] = useState('');

  // -- Invite surprise lie a ce groupe (photo + approbation) -- demande de
  // Gersom le 02/09/2026, voir 0046_guest_approval_linked_invitation.sql.
  // Pas de flux camera live ici (contrairement a /scan) : un simple input
  // fichier avec capture="environment" ouvre directement l'appareil photo
  // du telephone sur iOS/Android.
  const [surprisePhoto, setSurprisePhoto] = useState<File | null>(null);
  const surprisePhotoInputRef = useRef<HTMLInputElement>(null);

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
          invitationTableIdRef.current = inv.table_id;
          setArriveValue(inv.nombre_arrive);
          if (inv.table_id) {
            supabase
              .from('tables')
              .select('*')
              .eq('id', inv.table_id)
              .maybeSingle()
              .then(({ data: t }) => setInvitationTable((t as TableRow) || null));
          }
        } else {
          setNotFound(true);
        }
      });
  }, [invitationId]);

  const arriveValueRef = useRef(arriveValue);
  useEffect(() => {
    arriveValueRef.current = arriveValue;
  }, [arriveValue]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('checkin-' + invitationId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invitations', filter: 'id=eq.' + invitationId },
        (payload) => {
          const updated = payload.new as InvitationRow;
          // Garder la requete hors du setter React : un updater peut etre
          // rejoue en mode strict. La ref empeche aussi une reponse lente de
          // l'ancienne table d'ecraser un second deplacement plus recent.
          if (updated.table_id !== invitationTableIdRef.current) {
            invitationTableIdRef.current = updated.table_id;
            if (updated.table_id) {
              const requestedTableId = updated.table_id;
              void supabase
                .from('tables')
                .select('*')
                .eq('id', requestedTableId)
                .maybeSingle()
                .then(({ data: t }) => {
                  if (invitationTableIdRef.current === requestedTableId) {
                    setInvitationTable((t as TableRow) || null);
                  }
                });
            } else {
              setInvitationTable(null);
            }
          }
          setInvitation((prev) => {
            if (prev && updated.nombre_arrive !== prev.nombre_arrive) {
              if (arriveValueRef.current === prev.nombre_arrive) {
                setArriveValue(updated.nombre_arrive);
              } else {
                setSyncNotice(
                  "Cette fiche vient d'être modifiée par un autre agent — le total ci-dessus est à jour, vérifiez avant de confirmer."
                );
              }
            }
            return updated || prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invitationId]);

  const delta = invitation ? arriveValue - invitation.nombre_arrive : 0;

  // Charge TOUTES les tables (reserve ET normales) avec leur occupation
  // reelle ET estimee, pour permettre d'assigner l'excedent n'importe ou (pas
  // seulement en reserve). L'occupation estimee tient compte des invitations
  // marquees "ne viendra pas" (lib/capacity.ts) : leurs places prevues sont
  // retirees du calcul, ce qui libere une table "complete sur le papier" des
  // qu'on sait avec certitude qu'un groupe ne viendra pas.
  async function loadAllTableUsages(): Promise<TableCapacity[]> {
    const supabase = createClient();
    const [{ data: tables }, { data: assignments }, { data: allInvs }] = await Promise.all([
      supabase.from('tables').select('*').order('is_reserve', { ascending: false }).order('number'),
      supabase.from('overflow_assignments').select('*'),
      supabase.from('invitations').select('*'),
    ]);

    return computeTableCapacities(
      (tables as TableRow[]) || [],
      (allInvs as InvitationRow[]) || [],
      (assignments as OverflowAssignmentRow[]) || []
    );
  }

  // Ouvre l'ecran de gestion de l'excedent pour un total donne (calcule a
  // partir de nombre_arrive - nombre_prevu). Verifie d'abord ce qui a deja
  // ete assigne pour ce groupe (visites precedentes) afin de ne proposer
  // d'assigner que la part RESTANTE, jamais de dupliquer une assignation.
  async function openOverflowFlow(totalExcedent: number) {
    if (!invitation) return;
    setExcedentCount(0);
    setChosenReserveTable(null);
    setExistingAssignments([]);
    setConfirmFullTable(false);

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
      setSyncNotice(null);
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

  async function handleAddUnplanned() {
    if (!invitation) return;
    if (!unplannedPrenom.trim() && !unplannedNom.trim()) { setAddingUnplanned(false); return; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/members/add-unplanned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: invitation.id,
          prenom: unplannedPrenom.trim() || null,
          nom: unplannedNom.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l'ajout");
        return;
      }

      const updated = data.invitation as InvitationRow;
      setInvitation(updated);
      setArriveValue(updated.nombre_arrive);
      setLastDelta(1);
      setSyncNotice(null);
      setAddingUnplanned(false);
      setUnplannedPrenom('');
      setUnplannedNom('');
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
      setSyncNotice(null);
      setStep('success_retrait');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!invitation) return;
    const supabase = createClient();
    const { data: fresh } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitation.id)
      .maybeSingle();
    const freshInv = (fresh as InvitationRow) || invitation;

    if (freshInv.nombre_arrive !== invitation.nombre_arrive) {
      setInvitation(freshInv);
      if (arriveValue === invitation.nombre_arrive) {
        setArriveValue(freshInv.nombre_arrive);
        return;
      }
      setSyncNotice(
        "Cette fiche vient d'être modifiée par un autre agent — le total ci-dessus est à jour, vérifiez avant de confirmer."
      );
    }

    const freshDelta = arriveValue - freshInv.nombre_arrive;
    if (freshDelta > 0) {
      handleAdd(freshDelta);
    } else if (freshDelta < 0) {
      handleRemove(arriveValue);
    }
  }

  async function handleCancelLast() {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR ANNULER CETTE ENTRÉE');
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/checkin/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'no_checkin_to_cancel'
            ? 'Aucune entrée récente à annuler pour cet invité.'
            : data.error || "Échec de l'annulation"
        );
        return;
      }
      const updated = data.invitation as InvitationRow;
      setInvitation(updated);
      setArriveValue(updated.nombre_arrive);
      setSyncNotice(null);
      setStep('confirm');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setCancelling(false);
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

  // Marque (ou demarque) cette invitation comme "ne viendra pas", pour
  // liberer ses places prevues du calcul de capacite des tables partout dans
  // l'app, sans attendre la fin de soiree. Trace dans audit_logs cote serveur.
  async function handleToggleNoShow(noShow: boolean) {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE POUR VALIDER CETTE ENTRÉE');
      return;
    }
    setNoShowSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, no_show: noShow }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la mise à jour');
        return;
      }
      setInvitation(data.invitation as InvitationRow);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setNoShowSubmitting(false);
    }
  }

  function startRename() {
    if (!invitation) return;
    setRenameValue(invitation.nom_affichage);
    setRenameError(null);
    setRenaming(true);
  }

  async function handleSaveRename() {
    if (!invitation || !renameValue.trim()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRenameError('CONNEXION REQUISE');
      return;
    }
    setRenameSubmitting(true);
    setRenameError(null);
    try {
      const res = await fetch('/api/invitations/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, nouveau_nom: renameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenameError(
          data.error === 'invitation_not_found'
            ? 'Cette invitation a été retirée entre-temps.'
            : data.error || 'Échec du renommage'
        );
        return;
      }
      setInvitation(data.invitation as InvitationRow);
      setRenaming(false);
    } catch {
      setRenameError('Erreur réseau — réessayez');
    } finally {
      setRenameSubmitting(false);
    }
  }

  async function callTagApi(endpoint: 'add' | 'remove', tag: string) {
    if (!invitation) return;
    const res = await fetch('/api/invitations/tags/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitation.id, tag }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error === 'invitation_not_found'
          ? 'Cette invitation a été retirée entre-temps.'
          : data.error || 'Échec de la mise à jour des étiquettes'
      );
    }
    setInvitation(data.invitation as InvitationRow);
  }

  async function handleAddTag(tag: string) {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTagError('CONNEXION REQUISE');
      return;
    }
    setTagSubmitting(true);
    setTagError(null);
    try {
      // Cote_Gege et Cote_Nelly sont mutuellement exclusifs : on retire
      // l'autre avant d'ajouter le nouveau, pour ne jamais se retrouver avec
      // les deux en meme temps (ce que /plan-table et le CSV n'ont jamais
      // besoin de gerer).
      const autreCote =
        tag === 'Côté_Gege' ? 'Côté_Nelly' : tag === 'Côté_Nelly' ? 'Côté_Gege' : null;
      if (autreCote && invitation.tags.includes(autreCote)) {
        await callTagApi('remove', autreCote);
      }
      await callTagApi('add', tag);
    } catch (e) {
      setTagError(e instanceof Error ? e.message : 'Erreur réseau — réessayez');
    } finally {
      setTagSubmitting(false);
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTagError('CONNEXION REQUISE');
      return;
    }
    setTagSubmitting(true);
    setTagError(null);
    try {
      await callTagApi('remove', tag);
    } catch (e) {
      setTagError(e instanceof Error ? e.message : 'Erreur réseau — réessayez');
    } finally {
      setTagSubmitting(false);
    }
  }

  async function handleAddCustomTag() {
    const tag = customTag.trim();
    if (!tag) return;
    await handleAddTag(tag);
    setCustomTag('');
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Invitation introuvable</p>
        <p className="text-sm text-text-faint">Le lien utilisé ne correspond à aucune invitation.</p>
        <button className="btn-primary" onClick={() => router.push('/scan')}>
          Retour au scan
        </button>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-text-faint">Chargement…</div>
    );
  }

  if (step === 'success') {
    return (
      <SuccessScreen
        title="✓ ENTRÉE CONFIRMÉE"
        lines={[
          lastDelta + ' PERSONNE' + (lastDelta > 1 ? 'S' : '') + ' AJOUTÉE' + (lastDelta > 1 ? 'S' : ''),
          'Total : ' + invitation.nombre_arrive + ' / ' + invitation.nombre_prevu + ' prévues',
        ]}
        onCancelLast={handleCancelLast}
        cancelling={cancelling}
      />
    );
  }

  if (step === 'success_retrait') {
    return (
      <SuccessScreen
        title="✓ RETRAIT CONFIRMÉ"
        lines={[
          lastDelta + ' PERSONNE' + (lastDelta > 1 ? 'S' : '') + ' RETIRÉE' + (lastDelta > 1 ? 'S' : ''),
          'Total : ' + invitation.nombre_arrive + ' / ' + invitation.nombre_prevu + ' prévues',
        ]}
        onCancelLast={handleCancelLast}
        cancelling={cancelling}
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
            <p className="mt-1 text-text-muted">
              Prévu : {invitation.nombre_prevu} · Présents : {invitation.nombre_arrive}
            </p>
          </div>

          {existingAssignments.length > 0 && (
            <div>
              <p className="mb-2 font-semibold ">Déjà assigné</p>
              <div className="space-y-2">
                {existingAssignments.map(({ assignment, table }) => canReorganizeExcedent ? (
                  <button
                    key={assignment.id}
                    onClick={() => router.push('/tables/overflow/' + assignment.id)}
                    className="flex w-full items-center justify-between rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-left "
                  >
                    <span className="font-semibold">
                      +{assignment.nombre_personnes} · {table ? 'Table ' + table.number : 'Table inconnue'}
                      {table?.is_reserve ? ' (réserve)' : ''}
                    </span>
                    <span className="text-xs text-accent underline">Gérer</span>
                  </button>
                ) : (
                  <div key={assignment.id} className="flex w-full items-center justify-between rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 ">
                    <span className="font-semibold">+{assignment.nombre_personnes} · {table ? 'Table ' + table.number : 'Table inconnue'}{table?.is_reserve ? ' (réserve)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {excedentCount > 0 && (
            <div>
              <p className="mb-2 font-semibold ">
                Assigner {existingAssignments.length > 0 ? 'le reste (' + excedentCount + ')' : 'à une table'}
              </p>
              <div className="space-y-2">
                {reserveUsages.map((u) => {
                  // "Complet" est un AVERTISSEMENT, pas un blocage : ce calcul
                  // (libresEstimees) tient deja compte des invitations
                  // marquees "ne viendra pas", mais reste une ESTIMATION pour
                  // celles pas encore arrivees. libresMaintenant, lui, est
                  // toujours exact (places physiquement libres a l'instant).
                  const full = u.libresEstimees < excedentCount;
                  const selected = chosenReserveTable === u.table.id;
                  return (
                    <button
                      key={u.table.id}
                      onClick={() => {
                        setChosenReserveTable(u.table.id);
                        setConfirmFullTable(false);
                      }}
                      className={
                        'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                        (selected
                          ? 'border-accent bg-accent-tint '
                          : full
                          ? 'border-status-over/30 bg-status-over/5 '
                          : 'border-hairline bg-surface ')
                      }
                    >
                      <span className="font-semibold">
                        Table {u.table.number}
                        {u.table.is_reserve ? ' (réserve)' : ''}
                      </span>
                      <span className={'text-sm ' + (full ? 'text-status-over' : '')}>
                        {full ? 'COMPLET (prévu)' : u.occupationEstimee + ' / ' + u.table.capacity + ' places'}
                        {' · '}
                        {u.libresMaintenant} libre{u.libresMaintenant > 1 ? 's' : ''} maintenant
                      </span>
                    </button>
                  );
                })}
              </div>
              {chosenReserveTable &&
                reserveUsages.find((u) => u.table.id === chosenReserveTable) &&
                reserveUsages.find((u) => u.table.id === chosenReserveTable)!.libresEstimees < excedentCount && (
                  <label className="mt-2 flex items-start gap-2 rounded-xl2 border-2 border-status-over/30 bg-status-over/5 p-3 text-sm text-status-over">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      checked={confirmFullTable}
                      onChange={(e) => setConfirmFullTable(e.target.checked)}
                    />
                    <span>⚠️ Cette table affiche complet — je confirme que des places seront réellement libres.</span>
                  </label>
                )}
            </div>
          )}

          {error && <p className="text-sm font-medium text-status-over">{error}</p>}
        </div>

        <div className="space-y-3 px-4 pb-6">
          {excedentCount > 0 && (
            <button
              className="btn-primary w-full"
              disabled={
                !chosenReserveTable ||
                submitting ||
                !online ||
                (!!chosenReserveTable &&
                  !!reserveUsages.find((u) => u.table.id === chosenReserveTable) &&
                  reserveUsages.find((u) => u.table.id === chosenReserveTable)!.libresEstimees < excedentCount &&
                  !confirmFullTable)
              }
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
      <TopBar title={invitation.nom_affichage} backHref="/scan" onTitleClick={canRename ? startRename : undefined} />

      <div className="flex-1 px-4 py-6">
        <div className="card mb-4 space-y-1 text-center">
          {invitationTable && (
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Table {invitationTable.number}
              {invitationTable.label ? ' — ' + invitationTable.label : ''}
              {invitationTable.is_reserve ? ' (réserve)' : ''}
            </p>
          )}
          <p className="text-sm uppercase tracking-wide text-text-faint">Personnes prévues</p>
          <p className="font-display text-4xl font-bold ">{invitation.nombre_prevu}</p>
          <p className="text-sm text-text-faint">Actuellement enregistrées : {invitation.nombre_arrive}</p>
          {invitation.ne_viendra_pas && (
            <p className="text-sm font-semibold text-status-over">Marqué "ne viendra pas"</p>
          )}
        </div>

        <div className="card mb-4 flex flex-wrap items-center justify-center gap-2 py-3">
          {invitation.notes?.toLowerCase().includes('approuvé') && (
            <span className="rounded-full bg-status-complete/15 px-3 py-1 text-xs font-bold text-status-complete">✓ Invitation approuvée</span>
          )}
          <span className="rounded-full bg-accent-tint px-3 py-1 text-xs font-bold text-accent">
            Placement {PLACEMENT_LABELS[invitation.placement_status].toLowerCase()}
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-text-muted">
            {invitation.nombre_arrive > 0 ? `${invitation.nombre_arrive} arrivé${invitation.nombre_arrive > 1 ? 's' : ''}` : 'Non arrivé'}
          </span>
        </div>

        {canRename && renaming && (
          <div className="mb-3 space-y-2 rounded-xl2 border-2 border-hairline bg-surface p-3">
                <input
                  className="w-full rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-sm  placeholder:text-text-faint focus:border-accent focus:outline-none"
                  placeholder="Nom affiché"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                />
                {renameError && <p className="text-xs font-medium text-status-over">{renameError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1 py-2 text-sm"
                    disabled={renameSubmitting || !online || !renameValue.trim()}
                    onClick={handleSaveRename}
                  >
                    {renameSubmitting ? '…' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1 py-2 text-sm"
                    onClick={() => setRenaming(false)}
                  >
                    Annuler
                  </button>
                </div>
          </div>
        )}

        {(invitation.tags.length > 0 || canManageTags) && (
          <div className="mb-4 rounded-xl2 border-2 border-hairline bg-surface p-3">
            <p className="mb-2 text-sm font-semibold">🏷️ Étiquettes</p>
            {invitation.tags.length === 0 && <p className="mb-2 text-xs text-text-faint">Aucune étiquette pour l'instant.</p>}
            <div className={canManageTags ? 'mb-2 flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
              {invitation.tags.map((tag) => canManageTags ? (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-accent"
                  >
                    {libelleEtiquette(tag)}
                    <button
                      type="button"
                      aria-label={'Retirer ' + libelleEtiquette(tag)}
                      disabled={tagSubmitting}
                      className="ml-0.5 text-accent disabled:opacity-40"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span key={tag} className="rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-accent">{libelleEtiquette(tag)}</span>
                ))}
            </div>
            {canManageTags && <>
              <div className="mb-2 flex flex-wrap gap-2">
              {ETIQUETTES_RAPIDES.filter((e) => !invitation.tags.includes(e.value)).map((e) => (
                <button
                  key={e.value}
                  type="button"
                  disabled={tagSubmitting || !online}
                  className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-text-muted disabled:opacity-40"
                  onClick={() => handleAddTag(e.value)}
                >
                  + {e.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-sm placeholder:text-text-faint focus:border-accent focus:outline-none"
                placeholder="Autre étiquette"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary px-4 text-sm"
                disabled={tagSubmitting || !online || !customTag.trim()}
                onClick={handleAddCustomTag}
              >
                Ajouter
              </button>
            </div>
            {tagError && <p className="mt-2 text-xs font-medium text-status-over">{tagError}</p>}
            </>}
          </div>
        )}

        <GuestArrivalPanel
          invitation={invitation}
          onInvitationUpdate={setInvitation}
          onVisibilityChange={setHasMemberList}
          canManage={canRename}
          canMove={canMoveGuest}
        />

        <button
          type="button"
          className="action-row mb-3"
          onClick={() => router.push('/checkin/' + invitation.id + '/members')}
        >
          Gérer les membres du groupe (ajouter, retirer, nommer)
        </button>

        {canMerge && (
          <button
            type="button"
            className="action-row mb-3"
            onClick={() => router.push('/checkin/' + invitation.id + '/merge')}
          >
            ⇄ Fusionner avec un autre groupe
          </button>
        )}

        {invitation.nombre_arrive > invitation.nombre_prevu && (
          <button
            type="button"
            className="mb-3 block w-full text-center text-sm font-medium text-status-over underline underline-offset-2"
            onClick={() => openOverflowFlow(invitation.nombre_arrive - invitation.nombre_prevu)}
          >
            ⚠️ Gérer l’excédent ({invitation.nombre_arrive - invitation.nombre_prevu} personne
            {invitation.nombre_arrive - invitation.nombre_prevu > 1 ? 's' : ''})
          </button>
        )}

        {/* Ne propose de marquer "ne viendra pas" que tant que personne de ce
            groupe n'est arrive : une fois une arrivee enregistree, ce n'est
            plus pertinent (et record_checkin leve deja le marqueur tout seul
            si un groupe marque absent se presente quand meme).
            Cache des que GuestArrivalPanel ci-dessus affiche reellement une
            liste (son etat "ne_viendra_pas" par membre prend le relais,
            redondant sinon) -- demande de Gersom le 28/08/2026. Toujours
            visible pour une invitation solo (aucun detail de membres a
            afficher dans ce cas), et toujours visible si deja marquee (pour
            garder un moyen d'annuler). Base sur hasMemberList (etat reel du
            panneau), jamais sur nombre_prevu -- voir le commentaire sur
            hasMemberList plus haut. */}
        {invitation.nombre_arrive === 0 && (invitation.ne_viendra_pas || !hasMemberList) && (
          <button
            type="button"
            disabled={noShowSubmitting || !online}
            className="action-row-muted mb-6 disabled:opacity-40"
            onClick={() => handleToggleNoShow(!invitation.ne_viendra_pas)}
          >
            {invitation.ne_viendra_pas
              ? 'Annuler le marquage "ne viendra pas"'
              : 'Cet invité ne viendra pas (libère ses places prévues)'}
          </button>
        )}

        {hasMemberList ? (
          // Groupe : chaque personne se coche individuellement dans
          // GuestArrivalPanel ci-dessus (instantane, pas de bouton
          // "Confirmer" a part) -- seul reste a couvrir le cas d'un invite
          // qui se presente sans etre sur la liste nominative. Ajout NOMME
          // depuis v1.23.0 (add_unplanned_arrival, migration 0030) : ne
          // touche jamais nombre_prevu, pour continuer a declencher
          // l'assignation de table de reserve en cas de depassement.
          !canSubmitGuestApproval ? (
            // Ni l'ajout instantané ni le parcours photo ne sont accessibles
            // à ce rôle (agent_checkin, visibilite) -- un excédent de
            // personnes remonte toujours à un placeur/directeur/admin.
            <p className="action-row-muted mb-3 cursor-default text-text-muted">
              Une personne en plus ? Un placeur ou directeur peut l’ajouter.
            </p>
          ) : addingUnplanned ? (
            <div className="card mb-3">
              <p className="mb-2 text-sm font-semibold">Invité supplémentaire (non prévu)</p>
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  placeholder="Prénom"
                  value={unplannedPrenom}
                  onChange={(e) => setUnplannedPrenom(e.target.value)}
                />
                <input
                  className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  placeholder="Nom"
                  value={unplannedNom}
                  onChange={(e) => setUnplannedNom(e.target.value)}
                />
              </div>
              <div className="mt-2 flex justify-end gap-3 text-xs font-semibold">
                <button type="button" className="text-text-faint" onClick={() => setAddingUnplanned(false)} disabled={submitting}>
                  Annuler
                </button>
                <button type="button" className="text-accent" onClick={handleAddUnplanned} disabled={submitting || !online}>
                  {submitting ? '…' : !online ? 'HORS LIGNE' : 'Ajouter, déjà arrivé'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="action-row py-2 text-xs"
                disabled={submitting || !online}
                onClick={() => setAddingUnplanned(true)}
              >
                {!online ? 'HORS LIGNE' : '+ Non prévu'}
              </button>
              {/* Invite surprise lie a ce groupe : nom + photo + approbation,
                  avec cote/groupe deja preremplis (voir
                  GuestApprovalCaptureFlow). input file avec
                  capture="environment" ouvre l'appareil photo natif,
                  identique en usage a la capture live de /scan. */}
              <input
                ref={surprisePhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setSurprisePhoto(file);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                className="action-row py-2 text-xs"
                disabled={submitting || !online}
                onClick={() => surprisePhotoInputRef.current?.click()}
              >
                {!online ? 'HORS LIGNE' : '📷 Invité surprise'}
              </button>
            </div>
          )
        ) : (
          <>
            <p className="mb-3 text-center font-semibold ">Personnes arrivées</p>
            <CounterStepper value={arriveValue} min={0} max={30} onChange={setArriveValue} />

            {delta !== 0 && (
              <p className="mt-3 text-center text-sm font-medium text-accent">
                {delta > 0 ? '+' : ''}
                {delta} par rapport à maintenant
              </p>
            )}

            {arriveValue > invitation.nombre_prevu && (
              <p className="mt-3 text-center text-sm font-medium text-status-over">
                ⚠️ {arriveValue - invitation.nombre_prevu} personne{arriveValue - invitation.nombre_prevu > 1 ? 's' : ''} de plus que prévu
              </p>
            )}
          </>
        )}

        {syncNotice && (
          <p className="mt-3 rounded-xl2 border-2 border-hairline bg-accent-tint p-3 text-center text-sm font-medium text-accent">
            {syncNotice}
          </p>
        )}

        {error && <p className="mt-3 text-center text-sm font-medium text-status-over">{error}</p>}
      </div>

      {!hasMemberList && (
        <div className="space-y-3 px-4 pb-6">
          <button
            className="btn-primary w-full"
            disabled={delta === 0 || submitting || !online}
            onClick={handleConfirm}
          >
            {boutonLabel}
          </button>
        </div>
      )}

      {surprisePhoto && (
        <GuestApprovalCaptureFlow
          photo={surprisePhoto}
          initialCote={invitation.cote === 'Gege' || invitation.cote === 'Nelly' ? invitation.cote : undefined}
          linkedInvitationId={invitation.id}
          linkedLabel={invitation.nom_affichage + (invitationTable ? ' — Table ' + invitationTable.number : '')}
          onClose={() => setSurprisePhoto(null)}
        />
      )}
    </div>
  );
}

function SuccessScreen({
  title,
  lines,
  onCancelLast,
  cancelling,
}: {
  title: string;
  lines: string[];
  onCancelLast?: () => void;
  cancelling?: boolean;
}) {
  const router = useRouter();
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (!autoRedirect) return;
    const timer = setTimeout(() => router.push('/scan'), 3000);
    return () => clearTimeout(timer);
  }, [router, autoRedirect]);

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-status-complete px-6 text-center text-white"
      onPointerDown={() => setAutoRedirect(false)}
    >
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
      {onCancelLast && (
        <button
          type="button"
          disabled={cancelling}
          className="text-sm font-medium text-white/80 underline underline-offset-2 disabled:opacity-50"
          onClick={onCancelLast}
        >
          {cancelling ? 'Annulation…' : 'Annuler cette entrée'}
        </button>
      )}
    </div>
  );
}

