'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GuestArrivalStatus, GuestRow, InvitationRow } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import { parseMembersFromNotes } from '@/lib/membersNotes';
import { debounce } from '@/lib/debounce';
import { TABLE_SEAT_NAMES, findSeatIndexByName, namesMatch } from '@/lib/floorPlanSeats';
import { TableSeatWheel } from '@/components/TableSeatWheel';

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
  tableNumber,
  onInvitationUpdate,
  onVisibilityChange,
  onAfterAdd,
  onOpenSurpriseGuest,
  onFinish,
  onMerge,
  canManage,
  canAdd,
  canMove,
  canMerge,
}: {
  invitation: InvitationRow;
  // v1.48.5, retour de Gersom : afficher directement sur cette fiche le
  // dessin "vu sur le plan photographié" de la table de CE groupe (au lieu
  // de forcer un aller-retour vers /plan-table) -- numéro de la vraie table
  // assignée (invitations.table_id -> tables.number), jamais devinée par
  // nom : `null` tant que l'invitation n'a pas encore de table, auquel cas
  // ce panneau ne s'affiche simplement pas (voir plus bas).
  tableNumber: number | null;
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
  // submitGuestApproval, PAS a manageMembers (le 14/09/2026, agent_checkin a
  // justement perdu manageMembers -- ce role ne doit jamais renommer ni
  // faire apparaitre quelqu'un de deja arrive sans passer par un placeur).
  // Consolidation du 03/09/2026 (retour de Gersom :
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
  // v1.48.5 : lance le parcours photo + approbation à distance ("Invité
  // surprise") -- fourni par le parent (app/checkin/[invitationId]/page.tsx
  // possède déjà cette logique/l'état `showCamera`), simplement affiché ici
  // en petite icône à côté du "+" plutôt qu'en gros bouton séparé plus bas
  // sur la page (retour de Gersom : "le bouton invité surprise... un simple
  // icône de caméra à côté de l'icône +"). Absent = icône masquée, comme
  // avant l'ajout de ce prop.
  onOpenSurpriseGuest?: () => void;
  // v1.48.5 : bouton "Terminé" à côté du "+"/caméra -- "la flèche retour
  // n'est pas intuitive... quand on clique Terminé ça nous retourne sur la
  // page du scanner". Toujours affiché quand fourni, indépendamment de
  // `canAdd` (utile à tous les rôles, pas seulement ceux qui peuvent ajouter
  // un invité) -- la navigation elle-même reste décidée par le parent.
  onFinish?: () => void;
  // v1.53.11, retour de Gersom : "le bouton fusionner... juste en haut du
  // plan, parce que sinon on ne le voit plus, il se perd" -- vivait jusqu'ici
  // dans la page parente, APRÈS ce panneau (donc après les deux cartes,
  // caméra/plan compris) ; déplacé ici pour être positionné juste au-dessus
  // du dessin "vu sur le plan photographié". Même capacité (mergeInvitations)
  // et même navigation (/checkin/[invitationId]/merge), simplement rendus
  // à cet endroit précis plutôt que par le parent.
  onMerge?: () => void;
  canMerge?: boolean;
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

  // v1.48.5 : sieges mis en evidence dans le dessin "vu sur le plan
  // photographie" ci-dessous -- purement visuel/local, jamais envoye au
  // serveur (voir lib/floorPlanSeats.ts). Reinitialise a chaque changement
  // d'invitation par le meme effet que `members`/`loading` plus bas, pour
  // ne jamais rester colle sur le siege d'une invitation precedente.
  const [highlightedSeats, setHighlightedSeats] = useState<number[]>([]);
  // v1.48.9, retour de Gersom : "vice versa -- si j'appuie sur la chaise de
  // la personne en dessous, ça me surligne directement dans cette page
  // parmi les invités... c'est qui" -- meme etat que highlightedSeats, mais
  // pour la ligne du membre correspondant (jamais l'inverse d'une recherche
  // approchee : uniquement quand namesMatch trouve une correspondance
  // exacte). Reinitialise partout ou highlightedSeats l'est deja.
  const [highlightedGuestId, setHighlightedGuestId] = useState<string | null>(null);
  const seatWheelRef = useRef<HTMLDivElement>(null);
  const membersListRef = useRef<HTMLUListElement>(null);
  // v1.53.11, retour de Gersom : "quand on arrive sur cette page de
  // check-in, il faudra directement que le nom des invitations qui
  // correspondent soit directement highlight sur la table en bas" -- jusqu'ici
  // il fallait toucher un 📍/un siège pour surligner quoi que ce soit.
  // Marque l'invitation déjà traitée pour ne le faire qu'une seule fois par
  // fiche (jamais reécraser un choix manuel ultérieur, ex. après un tap sur
  // un siège différent ou un renommage qui recharge `members`).
  const autoHighlightedInvitationIdRef = useRef<string | null>(null);

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
    // Corrige le 13/09/2026 (retour de Gersom : "cette page va flasher en
    // premier... l'ancien compteur apparait encore") -- Next.js reutilise
    // cette meme instance de GuestArrivalPanel en passant d'une invitation a
    // une autre (meme pattern que le correctif du 03/09/2026 sur la page
    // /checkin/[invitationId] elle-meme), donc sans ce reset les etats
    // `loading`/`initializing`/`members` de l'invitation PRECEDENTE restaient
    // affiches pendant que la requete pour la NOUVELLE invitation etait
    // encore en vol. Concretement : si l'invitation precedente etait un
    // invite solo (visible=false, donc le parent affichait deja son ancien
    // compteur +/-), naviguer vers un GROUPE ne redeclenchait l'effet
    // `[settled, visible]` que quand `visible` changeait reellement -- avec
    // l'ancien `visible=false` fige, le parent restait sur le compteur
    // jusqu'a ce que `load()` resolve, d'ou le flash. Reinitialiser
    // synchroniquement ici (et prevenir `onVisibilityChange(true)` de facon
    // optimiste, comme le fait deja la page parente pour son propre etat)
    // fait disparaitre ce compteur perime des le changement d'invitation.
    setLoading(true);
    setInitializing(false);
    setMembers([]);
    setHighlightedSeats([]);
    setHighlightedGuestId(null);
    autoHighlightedInvitationIdRef.current = null;
    onVisibilityChange?.(true);
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
        // Corrige le 13/09/2026 (retour de Gersom : "la photo trois... reste
        // là quelques millisecondes et boom après la photo 2 arrive",
        // surtout en arrivant depuis /plan-table -- une invitation jamais
        // encore ouverte, donc pas encore materialisee). `load()` ci-dessus
        // vient deja de faire `setLoading(false)` en trouvant 0 ligne ; sans
        // ce `setInitializing(true)` ICI (contrairement a la branche
        // "initialize" juste au-dessus, qui le fait), `settled` devenait
        // brievement vrai avec `visible=false` pendant cet appel --
        // suffisant pour que le parent bascule sur l'ancien compteur +/-
        // avant que cet appel ne resolve et ne retrouve la ligne creee.
        setInitializing(true);
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

  // v1.53.11 : surligne d'emblee, une seule fois par fiche (voir
  // autoHighlightedInvitationIdRef ci-dessus), tous les sieges dont le nom
  // correspond exactement a un membre deja liste -- sans attendre un tap sur
  // un 📍. Ne remplace jamais un choix fait ensuite par l'agent (tap sur un
  // siege ou un 📍 different) : ce n'est qu'un point de depart.
  useEffect(() => {
    if (!settled || !visible) return;
    if (autoHighlightedInvitationIdRef.current === invitation.id) return;
    const currentSeats = tableNumber !== null ? TABLE_SEAT_NAMES[tableNumber] : undefined;
    if (!currentSeats) return;
    autoHighlightedInvitationIdRef.current = invitation.id;
    const indices: number[] = [];
    for (const guest of members) {
      const idx = findSeatIndexByName(tableNumber as number, guest.nom_affichage);
      if (idx !== null && !indices.includes(idx)) indices.push(idx);
    }
    if (indices.length > 0) setHighlightedSeats(indices);
  }, [settled, visible, invitation.id, tableNumber, members]);

  if (!settled) return <div className="card mb-3 text-center text-sm text-text-faint">Chargement des membres…</div>;
  if (!visible) return null;

  // v1.48.5 : memes seuils que /plan-table (TABLE_SEAT_NAMES[number] absent
  // = cette table n'a pas de lecture photo, le panneau ne s'affiche pas).
  const seats = tableNumber !== null ? TABLE_SEAT_NAMES[tableNumber] : undefined;

  return (
    <>
    <div className="card mb-3">
      <p className="mb-2 text-sm font-semibold">Qui est arrivé ?</p>
      <ul ref={membersListRef} className="space-y-1.5">
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

          // v1.48.5 : correspondance exacte (accents/casse ignores) entre ce
          // membre et un siege lu sur la photo de SA table reelle -- jamais
          // une recherche floue ni sur une autre table (voir
          // lib/floorPlanSeats.ts). Icone masquee si aucune correspondance :
          // rien a montrer plutot qu'un bouton mort.
          const seatIndex = tableNumber !== null ? findSeatIndexByName(tableNumber, guest.nom_affichage) : null;
          return (
            <li
              key={guest.id}
              className={
                'flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors ' +
                (wontCome ? 'opacity-45 ' : '') +
                (guest.id === highlightedGuestId ? 'bg-accent-tint ring-1 ring-accent/40' : '')
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
              {seatIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    const isDeselect = highlightedSeats.length === 1 && highlightedSeats[0] === seatIndex;
                    setHighlightedSeats(isDeselect ? [] : [seatIndex]);
                    setHighlightedGuestId(isDeselect ? null : guest.id);
                    requestAnimationFrame(() => {
                      seatWheelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    });
                  }}
                  aria-label={'Voir le siège de ' + guest.nom_affichage + ' sur le plan photographié'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-hairline text-sm text-text-faint active:scale-90 transition-transform"
                >
                  📍
                </button>
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

      {/* v1.48.5, retour de Gersom : le "+" (ajout direct, inchangé) et la
          caméra (parcours photo + approbation, désormais une simple icône
          au lieu d'un gros bouton séparé plus bas sur la page) côte à côte,
          "Terminé" à droite -- "la flèche retour n'est pas intuitive...
          quand on clique Terminé ça nous retourne sur la page du scanner".
          Row affichée dès que l'un des trois boutons a une raison d'exister. */}
      {!adding && (canAdd || onFinish) && (
        <div className="mt-2 flex items-center gap-2">
          {canAdd && (
            <button
              type="button"
              onClick={startAdd}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-hairline text-lg font-bold text-text-faint active:scale-90 transition-transform"
              aria-label="Ajouter une personne arrivée avec le groupe"
            >
              +
            </button>
          )}
          {canAdd && onOpenSurpriseGuest && (
            <button
              type="button"
              onClick={onOpenSurpriseGuest}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-hairline text-base active:scale-90 transition-transform"
              aria-label="Invité surprise : ajouter avec photo et approbation à distance"
            >
              📷
            </button>
          )}
          {onFinish && (
            <button
              type="button"
              onClick={onFinish}
              className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-bold text-on-accent active:scale-95 transition-transform"
            >
              Terminé
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-status-over">{error}</p>}
    </div>

    {canMerge && onMerge && (
      <button type="button" className="action-row mb-3" onClick={onMerge}>
        ⇄ Fusionner avec un autre groupe
      </button>
    )}

    {/* v1.53.11, retour de Gersom : "enlève le petit message... toucher un
        nom ou blablabla... on connaît déjà le fonctionnement" -- le texte
        d'instructions ("Touchez un nom...") affiché sous le dessin sur les
        autres pages (/plan-table, /tables/[tableId]) est retiré ICI
        uniquement : cette fiche est justement celle où l'agent vient de
        voir le mécanisme se déclencher tout seul (surlignage automatique
        ci-dessus), plus besoin de l'expliquer. */}
    {seats && (
      <div ref={seatWheelRef} className="card mb-3 p-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-text-faint">
          Vu sur le plan photographié · à titre indicatif
        </p>
        <TableSeatWheel
          tableNumber={tableNumber as number}
          seats={seats}
          highlightedIndices={highlightedSeats}
          onSelectSeat={(idx) => {
            const isDeselect = highlightedSeats.length === 1 && highlightedSeats[0] === idx;
            setHighlightedSeats(isDeselect ? [] : [idx]);
            if (isDeselect) {
              setHighlightedGuestId(null);
              return;
            }
            // v1.48.9 : "vice versa" -- toucher un siege retrouve, parmi les
            // membres DEJA LISTES ici, celui dont le nom correspond
            // exactement (jamais approche) au nom lu sur ce siege.
            const seatName = seats[idx];
            const match = seatName ? members.find((guest) => namesMatch(guest.nom_affichage, seatName)) : undefined;
            setHighlightedGuestId(match ? match.id : null);
            if (match) {
              requestAnimationFrame(() => {
                membersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              });
            }
          }}
        />
      </div>
    )}
    </>
  );
}
