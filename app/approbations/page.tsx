'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';

interface ApprovalListItem {
  id: string;
  cote: 'Nelly' | 'Gege';
  nom_invite: string;
  nombre_invites: number;
  statut: 'en_attente' | 'approuve' | 'refuse';
  decided_at: string | null;
  decided_via: 'web' | 'whatsapp' | null;
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

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch('/api/guest-approvals');
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
      setLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (role && !hasCapability(role, 'guestApproval')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <TopBar title="Approbations" backHref="/scan" />
        <p className="mt-8 text-lg font-semibold">Accès réservé</p>
        <p className="text-sm text-text-faint">
          Seuls l'admin, les directeurs de festin et les agents placeurs peuvent voir les demandes d'invités surprise.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Approbations" backHref="/scan" />

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading && <p className="text-center text-text-faint">Chargement…</p>}
          {!loading && requests.length === 0 && (
            <p className="text-center text-text-faint">Aucune demande d'invité surprise pour l'instant.</p>
          )}

          {requests.map((r) => (
            <div key={r.id} className="card flex gap-3">
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
                  {r.decided_via ? ' · via ' + (r.decided_via === 'whatsapp' ? 'WhatsApp' : 'lien web') : ''}
                </p>
                {r.table_number ? (
                  <p className="mt-1 text-xs font-semibold text-status-complete">Table {r.table_number} assignée</p>
                ) : r.statut === 'approuve' ? (
                  <Link href={'/approbations/' + r.id + '/assign'} className="action-row mt-2 py-2 text-xs">
                    Assigner une table
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {role && <BottomNav role={role} />}
    </div>
  );
}
