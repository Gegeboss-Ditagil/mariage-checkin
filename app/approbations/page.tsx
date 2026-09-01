'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { PushNotificationButton } from '@/components/PushNotificationButton';

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
  const [requests, setRequests] = useState<ApprovalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRequest = requests.find((request) => request.id === selectedId) || null;

  async function load() {
    const res = await fetch('/api/guest-approvals');
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests || []);
    }
    setLoading(false);
  }

  async function decide(id: string, decision: 'approuve' | 'refuse') {
    setDecidingId(id);
    const response = await fetch(`/api/guest-approvals/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (response.ok) await load();
    setDecidingId(null);
  }

  useEffect(() => {
    let active = true;
    async function loadCurrent() {
      const res = await fetch('/api/guest-approvals');
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
      setLoading(false);
    }
    loadCurrent();
    const interval = setInterval(loadCurrent, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId]);

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
          {role && hasCapability(role, 'reviewGuestApproval') && <PushNotificationButton />}
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
              onClick={() => setSelectedId(r.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
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
                {r.statut === 'en_attente' && role && hasCapability(role, 'reviewGuestApproval') && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={decidingId === r.id} onClick={(event) => { event.stopPropagation(); void decide(r.id, 'approuve'); }} className="rounded-xl bg-status-complete px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approuver</button>
                    <button type="button" disabled={decidingId === r.id} onClick={(event) => { event.stopPropagation(); void decide(r.id, 'refuse'); }} className="rounded-xl bg-status-over px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Refuser</button>
                  </div>
                )}
                {r.table_number ? (
                  <p className="mt-1 text-xs font-semibold text-status-complete">Table {r.table_number} assignée</p>
                ) : r.statut === 'approuve' && role && hasCapability(role, 'assignGuestApproval') ? (
                  <Link onClick={(event) => event.stopPropagation()} href={'/approbations/' + r.id + '/assign'} className="action-row mt-2 py-2 text-xs">
                    Assigner une table
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {role && <BottomNav role={role} />}

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-detail-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-4 shadow-elev-2"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Demande d'approbation</p>
                <h2 id="approval-detail-title" className="font-display text-2xl">{selectedRequest.nom_invite}</h2>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-text-muted">
                Fermer
              </button>
            </div>

            {selectedRequest.photo_signed_url ? (
              <img
                src={selectedRequest.photo_signed_url}
                alt={'Photo de la demande pour ' + selectedRequest.nom_invite}
                className="max-h-[48dvh] w-full rounded-2xl bg-black object-contain"
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl bg-surface-2 text-sm text-text-faint">Photo indisponible</div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={'rounded-full px-3 py-1 text-sm font-bold ' + (selectedRequest.cote === 'Gege' ? 'bg-gege/15 text-gege' : 'bg-nelly/15 text-nelly')}>
                Côté {selectedRequest.cote === 'Gege' ? 'Gégé' : 'Nelly'}
              </span>
              <span className={'rounded-full px-3 py-1 text-sm font-bold ' + STATUS_BADGE[selectedRequest.statut]}>
                {STATUS_LABEL[selectedRequest.statut]}
              </span>
            </div>

            <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-text-muted">
              <p>{selectedRequest.nombre_invites} invité{selectedRequest.nombre_invites > 1 ? 's' : ''}</p>
              {selectedRequest.requested_by_nom && <p>Demandé par {selectedRequest.requested_by_nom}</p>}
              {selectedRequest.table_number && <p className="font-semibold text-status-complete">Table {selectedRequest.table_number} assignée</p>}
            </div>

            {selectedRequest.statut === 'en_attente' && role && hasCapability(role, 'reviewGuestApproval') && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" disabled={decidingId === selectedRequest.id} onClick={() => void decide(selectedRequest.id, 'approuve')} className="min-h-12 rounded-xl bg-status-complete px-4 py-3 font-bold text-white disabled:opacity-50">Approuver</button>
                <button type="button" disabled={decidingId === selectedRequest.id} onClick={() => void decide(selectedRequest.id, 'refuse')} className="min-h-12 rounded-xl bg-status-over px-4 py-3 font-bold text-white disabled:opacity-50">Refuser</button>
              </div>
            )}

            {selectedRequest.statut === 'approuve' && !selectedRequest.table_id && role && hasCapability(role, 'assignGuestApproval') && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold">Qui doit attribuer la table ?</p>
                <Link href={'/approbations/' + selectedRequest.id + '/assign'} className="btn-primary block w-full text-center">
                  Choisir la table moi-même
                </Link>
                {role !== 'placeur' && (
                  <button type="button" onClick={() => setSelectedId(null)} className="btn-secondary w-full">
                    Laisser le placeur l'assigner
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
