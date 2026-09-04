'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GuestArrivalStatus, GuestRow, InvitationRow } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import { parseMembersFromNotes } from '@/lib/membersNotes';
import { debounce } from '@/lib/debounce';

// Remplace l'ancien compteur agrege "Personnes arrivees" (0..nombre_prevu,
// sans savoir QUI) par une case a cocher PAR PERSONNE, a trois etats.
// Demande de Gersom le 29/08/2026 sur un groupe de 5 : "on ne veut pas
// savoir le nombre de personnes, on veut savoir c'est qui". Reversible a
// tout moment en retapant le meme bouton -- contrairement a l'ancien
// panneau "Qui ne vient pas" (LiberationPlacesPanel, retire), aucune ligne
// n'est jamais supprimee ici : l'etat vit sur guests.arrival_status et sa
// coherence avec nombre_prevu/nombre_arrive est geree par la RPC
// set_guest_arrival_status (0029_guest_arrival_status.sql).
export function GuestArrivalPanel({
  invitation,
  onInvitationUpdate,
  onVisibilityChange,
  onAfterAdd,
  canManage,
  canAdd,
  canMove,
}: {
  invitation: InvitationRow;
  onInvitationUpdate: (inv: InvitationRow) => void;
  // Signale au parent si ce panneau affiche reellement une liste de membres,
  // pour qu'il sache s'il doit se rabattre sur l'ancien compteur agrege
  // (invitation vraiment solo, jamais de "Membres: ..." dans les notes).
  // A NE PAS deduire de nombre_prevu : ce nombre baisse des qu'une personne
  // passe en "ne_viendra_pas" (voir set_guest_arrival_status), donc un
  // groupe de 2 tombe a nombre_prevu=1 des la premiere personne exclue --
  // trouve par Gersom le 29/08/2026 : le panneau (et Mona dedans) disparaissait
  // completement des ce moment-la, plus aucun moyen de l'annuler.
  onVisibilityChange?: (visible: boolean) => void;
  // Appele apres un ajout reussi (voir saveAdd), avec l'invitation a jour --
  // permet au parent de declencher l'assignation d'excedent si besoin (le
  // "+" ajoute desormais quelqu'un DEJA ARRIVE, voir canAdd ci-dessous).
  onAfterAdd?: (updated: InvitationRow) => void;
  // Meme capacite que le renommage de l'invitation entiere (TopBar) --
  // demande de Gersom le 30/08/2026 : taper un nom modifie directement,
  // plus besoin de passer par "Gerer les membres du groupe" pour renommer.
  canManage?: boolean;
  // Ajouter quelqu'un qui arrive avec le groupe a la derniere minute : le
  // "+" appelle desormais add_unplanned_arrival (marque arrive tout de
  // suite, declenche l'excedent), pas add_invitation_member -- reserve a
  // submitGuestApproval, PAS a manageMembers (agent_checkin peut renommer
  // mais ne doit jamais faire apparaitre quelqu'un de deja arrive sans
  // passer par un placeur). Consolidation du 03/09/2026 (retour de Gersom :
  // "quand on ajoute la personne qui est avec Lys, ça veut dire que par
  // définition on approuve la personne et il faut la placer sur une table
  // ... [le bouton +Non prévu et le bouton Ajouter un invité] sont déjà
  // pris en compte avec le plus") -- remplace l'ancien "+ Non prévu" qui
  // vivait dans app/checkin/[invitationId]/page.tsx, avec exactement le
  // meme comportement (voir /api/members/add-unplanned).
  canAdd?: boolean;
  // Deplacer UNE personne vers une autre table, separement du reste du
  // groupe -- meme capacite que le deplacement d'une invitation entiere
  // (moveGuests). Demande de Gersom le 30/08/2026 : "ça va faciliter le
  // transfert de personnes d'une table à une autre parce que maintenant on
  // aura leurs noms".
  canMove?: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const [members, setMembers] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newPrenom, setNewPrenom] = useState('');
  const [newNom, setNewNom] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Ids des membres actuellement listes -- permet de filtrer LOCALEMENT les
  // evenements Realtime de la table globale `guests` (impossible de filtrer
  // cote serveur : le lien vers l'invitation vit dans invitation_guests).
  const memberIdsRef = useRef<Set<string>>(new Set());

  async function load() {
    const supabase = createClient();
    const { data: links } = await supabase
      .from('invitation_guests')
      .select('guest_id, guests(*)')
      .eq('invitation_id', invitation.id);
    const list = ((links || []) as any[])
      .map((l) => l.guests as GuestRow)
      .filter(Boolean)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    setMembers(list);
    memberIdsRef.current = new Set(list.map((g) => g.id));
    setLoading(false);
    return list;
  }

  // Materialise la liste "Membres: ..." (texte libre importe) en lignes
  // reelles des l'ouverture, sans attendre une premiere action de l'agent --
  // c'est le seul moyen d'avoir des noms a cocher immediatement plutot que
  // de retomber sur un compteur anonyme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list = await load();
      if (cancelled) return;
      const draft = parseMembersFromNotes(invitation.notes);
      // Préserve en priorité les vrais noms importés dans "Membres: ...".
      // La réparation générique ci-dessous ne sert qu'aux lignes encore
      // manquantes après cette matérialisation.
      if (list.length === 0 && draft.length > 0 && canManage) {
        setInitializing(true);
        await fetch('/api/members/initialize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_id: invitation.id, members: draft.map((m) => ({ prenom: m.prenom.trim() || null, nom: m.nom.trim() || null })) }),
        });
        if (!cancelled) list = await load();
      }
      const expectedRows = Math.max(invitation.nombre_prevu, invitation.nombre_arrive, 1);
      // Régression v1.30.1 : certains anciens groupes ont un compteur agrégé
      // mais aucune (ou trop peu de) lignes nominatives. Complète les lignes
      // manquantes sans modifier les totaux, puis affiche immédiatement ✓/X.
      if (list.length < expectedRows && canManage) {
        await fetch('/api/members/ensure', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_id: invitation.id }),
        });
        if (!cancelled) list = await load();
      }
      if (!cancelled) setInitializing(false);
    })();
    const supabase = createClient();
    // La table `guests` n'est pas filtrable par invitation cote serveur (le
    // lien vit dans invitation_guests) : on filtre donc LOCALEMENT avec les
    // membres deja listes -- une edition d'un invite d'une AUTRE invitation
    // ne declenche plus ce panneau. Tout est debounce pour les rafales.
    const reloadRelevant = debounce((payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }) => {
      const guestId = (payload.new && payload.new.id) || (payload.old && payload.old.id);
      if (guestId && memberIdsRef.current.has(String(guestId))) void load();
    }, 300);
    const channel = supabase
      .channel('guest-arrival-' + invitation.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests', filter: 'invitation_id=eq.' + invitation.id }, debounce(() => void load(), 300))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, reloadRelevant)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation.id]);

  async function setStatus(guest: GuestRow, status: GuestArrivalStatus) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('CONNEXION REQUISE'); return; }
    const next = guest.arrival_status === status ? 'attendu' : status;
    setPending((current) => new Set(current).add(guest.id));
    setError(null);
    // Optimiste : l'agent doit voir la coche reagir instantanement, le
    // canal temps reel (ou le rechargement ci-dessous) corrige si besoin.
    setMembers((current) => current.map((m) => (m.id === guest.id ? { ...m, arrival_status: next } : m)));
    try {
      const res = await fetch('/api/members/set-arrival-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guest.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de la mise à jour");
        await load();
        return;
      }
      onInvitationUpdate(data.invitation as InvitationRow);
    } catch {
      setError('Erreur réseau — réessayez');
      await load();
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(guest.id);
        return next;
      });
    }
  }

  function startEdit(guest: GuestRow) {
    setAdding(false);
    setEditingId(guest.id);
    setEditPrenom(guest.prenom || '');
    setEditNom(guest.nom || '');
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('CONNEXION REQUISE'); return; }
    setEditSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/members/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: editingId, prenom: editPrenom.trim() || null, nom: editNom.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec du renommage');
        return;
      }
      setMembers((current) => current.map((m) => (m.id === editingId ? { ...m, ...data.guest } : m)));
      setEditingId(null);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setEditSubmitting(false);
    }
  }

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setNewPrenom('');
    setNewNom('');
    setError(null);
  }

  async function saveAdd() {
    if (!newPrenom.trim() && !newNom.trim()) { setAdding(false); return; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('CONNEXION REQUISE'); return; }
    setAddSubmitting(true);
    setError(null);
    try {
      // add-unplanned (pas add) : cette personne arrive AVEC le groupe, elle
      // doit donc etre marquee arrivee immediatement, pas simplement ajoutee
      // a la liste prevue -- voir canAdd ci-dessus.
      const res = await fetch('/api/members/add-unplanned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, prenom: newPrenom.trim() || null, nom: newNom.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l'ajout");
        return;
      }
      const updated = data.invitation as InvitationRow;
      onInvitationUpdate(updated);
      await load();
      setAdding(false);
      setNewPrenom('');
      setNewNom('');
      onAfterAdd?.(updated);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setAddSubmitting(false);
    }
  }

  // Bug signale par Gersom le 30/08/2026 (deux ecrans qui s'affichent l'un
  // apres l'autre en ouvrant une fiche) : `loading` passe a `false` des le
  // premier chargement (members encore vide), donc `visible` valait
  // brievement `false` -- le parent recevait "pas de liste" et affichait le
  // vieux compteur agrege AVANT que la vraie liste (ou sa materialisation
  // depuis les notes) n'arrive, puis re-basculait vers le nouveau panneau.
  // Fix : ne prevenir le parent qu'une fois l'etat vraiment stabilise
  // (chargement ET materialisation eventuelle tous les deux termines), pas
  // a chaque etape intermediaire.
  const settled = !loading && !initializing;
  const visible = members.length > 0;
  useEffect(() => {
    if (!settled) return;
    onVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, visible]);

  if (!settled) return <div className="card mb-3 text-center text-sm text-text-faint">Chargement des membres…</div>;
  if (!visible) return null;

  return (
    <div className="card mb-3">
      <p className="mb-2 text-sm font-semibold">Qui est arrivé ?</p>
      <ul className="space-y-1.5">
        {members.map((guest) => {
          const busy = pending.has(guest.id) || initializing;
          const arrived = guest.arrival_status === 'arrive';
          const wontCome = guest.arrival_status === 'ne_viendra_pas';

          if (editingId === guest.id) {
            return (
              <li key={guest.id} className="rounded-xl border border-hairline p-2">
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="Prénom"
                    value={editPrenom}
                    onChange={(e) => setEditPrenom(e.target.value)}
                  />
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="Nom"
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                  />
                </div>
                <div className="mt-1.5 flex justify-end gap-3 text-xs font-semibold">
                  <button type="button" className="text-text-faint" onClick={() => setEditingId(null)} disabled={editSubmitting}>
                    Annuler
                  </button>
                  <button type="button" className="text-accent" onClick={saveEdit} disabled={editSubmitting || !online}>
                    Enregistrer
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li
              key={guest.id}
              className={
                'flex items-center gap-2 rounded-xl px-1.5 py-1.5 ' + (wontCome ? 'opacity-45' : '')
              }
            >
              {canManage ? (
                <button
                  type="button"
                  onClick={() => startEdit(guest)}
                  aria-label={'Modifier le nom de ' + guest.nom_affichage}
                  className={'min-w-0 flex-1 truncate text-left text-sm ' + (wontCome ? 'line-through' : '')}
                >
                  {guest.nom_affichage}
                </button>
              ) : (
                <span className={'min-w-0 flex-1 truncate text-sm ' + (wontCome ? 'line-through' : '')}>
                  {guest.nom_affichage}
                </span>
              )}
              {canMove && (
                <button
                  type="button"
                  onClick={() => router.push('/tables/move-guest/' + guest.id)}
                  aria-label={'Déplacer ' + guest.nom_affichage + ' vers une autre table'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-hairline text-sm text-text-faint active:scale-90 transition-transform"
                >
                  ⇄
                </button>
              )}
              <button
                type="button"
                aria-label={(arrived ? 'Annuler l’arrivée de ' : 'Marquer arrivé : ') + guest.nom_affichage}
                aria-pressed={arrived}
                disabled={busy || !online}
                onClick={() => setStatus(guest, 'arrive')}
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold transition-transform active:scale-90 disabled:opacity-40 ' +
                  (arrived
                    ? 'border-status-complete bg-status-complete text-white'
                    : 'border-hairline text-text-faint')
                }
              >
                ✓
              </button>
              <button
                type="button"
                aria-label={(wontCome ? 'Annuler "ne viendra pas" pour ' : 'Ne viendra pas : ') + guest.nom_affichage}
                aria-pressed={wontCome}
                disabled={busy || !online}
                onClick={() => setStatus(guest, 'ne_viendra_pas')}
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold transition-transform active:scale-90 disabled:opacity-40 ' +
                  (wontCome
                    ? 'border-status-over bg-status-over text-white'
                    : 'border-hairline text-text-faint')
                }
              >
                ✕
              </button>
            </li>
          );
        })}

        {canAdd && adding && (
          <li className="rounded-xl border border-hairline p-2">
            <p className="mb-1.5 text-xs font-semibold text-text-muted">Invité supplémentaire (non prévu)</p>
            <div className="flex gap-1.5">
              <input
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                placeholder="Prénom"
                value={newPrenom}
                onChange={(e) => setNewPrenom(e.target.value)}
              />
              <input
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                placeholder="Nom"
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
              />
            </div>
            <div className="mt-1.5 flex justify-end gap-3 text-xs font-semibold">
              <button type="button" className="text-text-faint" onClick={() => setAdding(false)} disabled={addSubmitting}>
                Annuler
              </button>
              <button type="button" className="text-accent" onClick={saveAdd} disabled={addSubmitting || !online}>
                {addSubmitting ? '…' : !online ? 'HORS LIGNE' : 'Ajouter, déjà arrivé'}
              </button>
            </div>
          </li>
        )}
      </ul>

      {canAdd && !adding && (
        <button
          type="button"
          onClick={startAdd}
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-hairline text-lg font-bold text-text-faint active:scale-90 transition-transform"
          aria-label="Ajouter une personne arrivée avec le groupe"
        >
          +
        </button>
      )}

      {error && <p className="mt-2 text-xs font-medium text-status-over">{error}</p>}
    </div>
  );
}
