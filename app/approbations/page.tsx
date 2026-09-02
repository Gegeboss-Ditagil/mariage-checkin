'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { PushNotificationButton } from '@/components/PushNotificationButton';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons';
import { readGuestApprovalsCache, refreshGuestApprovals, warmGuestApprovals } from '@/lib/guestApprovalClientCache';

interface ApprovalListItem {
  id: string;
  cote: 'Nelly' | 'Gege';
  nom_invite: string;
  nombre_invites: number;
  statut: 'en_attente' | 'approuve' | 'refuse';
  decided_at: string | null;
  decided_via: 'web' | 'whatsapp' | 'app' | null;
  table_id: string | null;
  table_number: number | null;
  // Table pre-reservee pendant que la demande est encore en_attente (voir
  // 0044_guest_approval_pre_approval_reservation.sql) -- distincte de
  // table_id (assignation confirmee, apres approbation).
  reserved_table_id: string | null;
  reserved_table_number: number | null;
  assigned_at: string | null;
  created_at: string;
  requested_by_nom: string | null;
  photo_signed_url: string | null;
}

const STATUS_LABEL: Record<ApprovalListItem['statut'], string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
};

const STATUS_BADGE: Record<ApprovalListItem['statut'], string> = {
  en_attente: 'bg-status-partial text-white',
  approuve: 'bg-status-complete text-white',
  refuse: 'bg-status-over text-white',
};

function placementLabel(request: ApprovalListItem) {
  if (request.statut === 'refuse') return 'Refusé';
  if (request.statut === 'en_attente') {
    return request.reserved_table_number
      ? `En attente — Table ${request.reserved_table_number} réservée`
      : 'En attente de décision';
  }
  return request.table_number ? `Approuvé — Table ${request.table_number}` : 'Approuvé — sans table';
}

// Sondage plutôt qu'un abonnement temps réel websocket -- guest_approval_requests
// n'a volontairement aucune policy RLS anon (le token doit rester
// confidentiel, voir migration 0032), donc pas de postgres_changes possible
// directement depuis le client sur cette table. 15s reste largement assez
// réactif pour un écran de suivi staff (pas l'écran principal que tout le
// monde garde ouvert pendant l'événement, contrairement à /scan) -- réglé à
// 5s à l'origine, resserré le 30/08/2026 après un point performance : chaque
// sondage régénère une URL signée par photo côté serveur (appel Storage),
// inutile de le faire toutes les 5s pour un écran secondaire.
const POLL_INTERVAL_MS = 15000;

export default function ApprobationsPage() {
  const role = useSessionRole();
  const initialCache = readGuestApprovalsCache();
  const [requests, setRequests] = useState<ApprovalListItem[]>((initialCache?.requests || []) as ApprovalListItem[]);
  const [loading, setLoading] = useState(!initialCache);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const decidingRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const selectedRequest = requests.find((request) => request.id === selectedId) || null;
  const selectedIndex = selectedRequest ? requests.findIndex((request) => request.id === selectedRequest.id) : -1;

  function moveSelection(delta: number) {
    if (requests.length < 2 || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + delta + requests.length) % requests.length;
    setActionFeedback(null);
    setSelectedId(requests[nextIndex].id);
  }

  async function load(refresh = true) {
    const data = await (refresh ? refreshGuestApprovals() : warmGuestApprovals());
    if (data) setRequests((data.requests || []) as ApprovalListItem[]);
    setLoading(false);
  }

  async function decide(id: string, decision: 'approuve' | 'refuse') {
    // Garde synchrone (ref, pas seulement le state `decidingId`) contre un
    // double-tap qui partirait avant le prochain rendu React -- corrige le
    // 02/09/2026 : Gersom obtenait parfois "déjà traitée" au tout premier
    // appui, signe possible d'un double envoi.
    if (decidingRef.current) return;
    decidingRef.current = id;
    setDecidingId(id);
    setActionFeedback(null);
    try {
      const response = await fetch(`/api/guest-approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json().catch(() => null);
      await load(true);
      if (response.ok) {
        // Si une table avait été réservée pendant que la demande était en
        // attente, l'approbation la finalise automatiquement (voir
        // lib/guestApprovalDecide.ts) -- le message le reflète au lieu de
        // toujours dire "sans table".
        const finalizedTableNumber = data?.request?.table?.number ?? null;
        setActionFeedback(
          decision === 'approuve'
            ? finalizedTableNumber
              ? `Fait — approuvé et placé à la Table ${finalizedTableNumber} (déjà réservée).`
              : 'Fait — approuvé sans table. La demande est maintenant visible par les placeurs.'
            : 'Parfait — demande refusée. La décision a bien été enregistrée.'
        );
      } else if (response.status === 409 && (data?.statut === 'approuve' || data?.statut === 'refuse')) {
        // Reflete le VRAI statut actuel (renvoyé par l'API) au lieu d'un
        // message generique -- evite la contradiction "deja traitee" a cote
        // d'une fiche qui semble pourtant encore "en attente".
        setActionFeedback(
          data.statut === 'approuve'
            ? 'Déjà traitée entre-temps : cette demande est maintenant Approuvée.'
            : 'Déjà traitée entre-temps : cette demande est maintenant Refusée.'
        );
      } else {
        setActionFeedback(data?.error || 'La décision n’a pas pu être enregistrée. Vérifiez le réseau et réessayez.');
      }
    } finally {
      decidingRef.current = null;
      setDecidingId(null);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadCurrent() {
      const data = await warmGuestApprovals();
      if (!active) return;
      if (data) {
        const loadedRequests = (data.requests || []) as ApprovalListItem[];
        setRequests(loadedRequests);
        const requestedId = new URLSearchParams(window.location.search).get('request');
        if (requestedId && loadedRequests.some((request: ApprovalListItem) => request.id === requestedId)) {
          setSelectedId(requestedId);
        }
      }
      setLoading(false);
    }
    loadCurrent();
    const interval = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
      if (event.key === 'ArrowLeft') moveSelection(-1);
      if (event.key === 'ArrowRight') moveSelection(1);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId, selectedIndex, requests.length]);

  if (role && !hasCapability(role, 'viewGuestApprovals')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <TopBar title="Approbations" backHref="/scan" />
        <p className="mt-8 text-lg font-semibold">Accès réservé</p>
        <p className="text-sm text-text-faint">
          Ce rôle ne peut pas voir les demandes d'approbation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Approbations" backHref="/scan" />

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {role && hasCapability(role, 'viewGuestApprovals') && <PushNotificationButton />}
          {loading && <p className="text-center text-text-faint">Chargement…</p>}
          {!loading && requests.length === 0 && (
            <p className="text-center text-text-faint">Aucune demande d'invité surprise pour l'instant.</p>
          )}

          {requests.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-label={'Ouvrir la demande de ' + r.nom_invite}
              onClick={() => { setActionFeedback(null); setSelectedId(r.id); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActionFeedback(null);
                  setSelectedId(r.id);
                }
              }}
              className="card flex cursor-pointer gap-3 transition-transform active:scale-[0.99]"
            >
              {r.photo_signed_url && (
                <img
                  src={r.photo_signed_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl2 border border-hairline object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{r.nom_invite}</p>
                  <span className={'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ' + STATUS_BADGE[r.statut]}>
                    {STATUS_LABEL[r.statut]}
                  </span>
                </div>
                <p className="text-xs text-text-faint">
                  {r.nombre_invites} invité{r.nombre_invites > 1 ? 's' : ''} · Côté {r.cote === 'Gege' ? 'Gégé' : 'Nelly'}
                  {r.requested_by_nom ? ' · demandé par ' + r.requested_by_nom : ''}
                  {r.decided_via ? ' · via ' + (r.decided_via === 'whatsapp' ? 'WhatsApp' : r.decided_via === 'app' ? "l'application" : 'lien web') : ''}
                </p>
                {r.table_number ? (
                  <p className="mt-1 text-xs font-semibold text-status-complete">Table {r.table_number} assignée</p>
                ) : r.statut === 'approuve' && role && hasCapability(role, 'assignGuestApproval') ? (
                  <Link onClick={(event) => event.stopPropagation()} href={'/approbations/' + r.id + '/assign'} className="action-row mt-2 py-2 text-xs">
                    Assigner une table
                  </Link>
                ) : r.statut === 'en_attente' && role && hasCapability(role, 'assignGuestApproval') ? (
                  r.reserved_table_number ? (
                    <Link onClick={(event) => event.stopPropagation()} href={'/approbations/' + r.id + '/assign'} className="mt-1 block text-xs font-semibold text-status-partial">
                      Table {r.reserved_table_number} réservée — modifier
                    </Link>
                  ) : (
                    <Link onClick={(event) => event.stopPropagation()} href={'/approbations/' + r.id + '/assign'} className="action-row mt-2 py-2 text-xs">
                      Réserver une table
                    </Link>
                  )
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {role && <BottomNav role={role} />}

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-detail-title"
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-hairline bg-surface/95 p-4 shadow-elev-2 backdrop-blur-2xl"
          >
            {requests.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Demande précédente"
                  onClick={() => moveSelection(-1)}
                  className="fixed left-3 top-[46%] z-[60] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-surface/80 text-accent shadow-elev-2 backdrop-blur-2xl transition-transform active:scale-90 sm:absolute sm:-left-16 sm:top-1/2"
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
                <button
                  type="button"
                  aria-label="Demande suivante"
                  onClick={() => moveSelection(1)}
                  className="fixed right-3 top-[46%] z-[60] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-surface/80 text-accent shadow-elev-2 backdrop-blur-2xl transition-transform active:scale-90 sm:absolute sm:-right-16 sm:top-1/2"
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              </>
            )}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Demande d'approbation</p>
                <h2 id="approval-detail-title" className="font-display text-2xl">{selectedRequest.nom_invite}</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer la demande"
                onClick={() => setSelectedId(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-surface/75 text-text shadow-sm backdrop-blur-xl transition-transform active:scale-90"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            {selectedRequest.photo_signed_url ? (
              <img
                src={selectedRequest.photo_signed_url}
                alt={'Photo de la demande pour ' + selectedRequest.nom_invite}
                className="max-h-[42dvh] w-full rounded-2xl bg-black object-contain"
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl bg-surface-2 text-sm text-text-faint">Photo indisponible</div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={'rounded-full px-3 py-1 text-sm font-bold ' + (selectedRequest.cote === 'Gege' ? 'bg-gege/15 text-gege' : 'bg-nelly/15 text-nelly')}>
                Côté {selectedRequest.cote === 'Gege' ? 'Gégé' : 'Nelly'}
              </span>
              <span className={'rounded-full px-3 py-1 text-sm font-bold ' + STATUS_BADGE[selectedRequest.statut]}>
                {placementLabel(selectedRequest)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-hairline bg-surface-2/70 p-2">
              <div className="col-span-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Nom</p>
                <p className="mt-0.5 font-semibold text-text">{selectedRequest.nom_invite}</p>
              </div>
              <div className="rounded-xl bg-surface px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Invités</p>
                <p className="mt-0.5 font-semibold text-text">{selectedRequest.nombre_invites}</p>
              </div>
              <div className="rounded-xl bg-surface px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Côté</p>
                <p className="mt-0.5 font-semibold text-text">{selectedRequest.cote === 'Gege' ? 'Gégé' : 'Nelly'}</p>
              </div>
              <div className="rounded-xl bg-surface px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Demandé par</p>
                <p className="mt-0.5 truncate font-semibold text-text">{selectedRequest.requested_by_nom || 'Non indiqué'}</p>
              </div>
              <div className="rounded-xl bg-surface px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Placement</p>
                {selectedRequest.table_number ? (
                  <p className="mt-0.5 font-semibold text-status-complete">Table {selectedRequest.table_number}</p>
                ) : selectedRequest.statut === 'approuve' && role && hasCapability(role, 'assignGuestApproval') ? (
                  <Link href={'/approbations/' + selectedRequest.id + '/assign'} className="mt-0.5 flex min-h-9 items-center justify-between gap-2 font-semibold text-accent underline decoration-accent/35 underline-offset-4">
                    Choisir une table
                    <ChevronRightIcon className="h-5 w-5" />
                  </Link>
                ) : selectedRequest.statut === 'en_attente' && role && hasCapability(role, 'assignGuestApproval') ? (
                  // Reserver une table AVANT l'approbation -- demande de
                  // Gersom le 02/09/2026 : "voir les tables disponibles, la
                  // mettre sur une table pour ne pas qu'on fasse du double
                  // booking" pendant que la demande attend encore une decision.
                  <Link href={'/approbations/' + selectedRequest.id + '/assign'} className="mt-0.5 flex min-h-9 items-center justify-between gap-2 font-semibold text-accent underline decoration-accent/35 underline-offset-4">
                    {selectedRequest.reserved_table_number ? `Table ${selectedRequest.reserved_table_number} réservée — modifier` : 'Réserver une table'}
                    <ChevronRightIcon className="h-5 w-5" />
                  </Link>
                ) : (
                  <p className="mt-0.5 font-semibold text-text-muted">À déterminer</p>
                )}
              </div>
            </div>

            {actionFeedback && (
              <p className="mt-4 rounded-2xl bg-accent-tint px-4 py-3 text-sm font-semibold text-accent" role="status">
                {actionFeedback}
              </p>
            )}

            {selectedRequest.statut === 'en_attente' && role && hasCapability(role, 'reviewGuestApproval') && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" disabled={decidingId === selectedRequest.id} onClick={() => void decide(selectedRequest.id, 'approuve')} className="min-h-12 rounded-xl bg-status-complete px-4 py-3 font-bold text-white disabled:opacity-50">Approuver</button>
                <button type="button" disabled={decidingId === selectedRequest.id} onClick={() => void decide(selectedRequest.id, 'refuse')} className="min-h-12 rounded-xl bg-status-over px-4 py-3 font-bold text-white disabled:opacity-50">Refuser</button>
              </div>
            )}

            {selectedRequest.statut === 'approuve' && !selectedRequest.table_id && role && hasCapability(role, 'assignGuestApproval') && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold">Souhaitez-vous aussi assigner une table ?</p>
                <Link href={'/approbations/' + selectedRequest.id + '/assign'} className="btn-primary block w-full text-center">
                  Oui — voir les recommandations
                </Link>
                {role !== 'placeur' && (
                  <button type="button" onClick={() => setSelectedId(null)} className="btn-secondary w-full">
                    Non — laisser le placeur l'assigner
                  </button>
                )}
                <p className="text-xs text-text-faint">
                  Sans choix immédiat, la demande reste approuvée et sans table dans la liste du placeur.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
