'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { EventRow } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  setup: 'Préparation',
  test: 'Mode test',
  live: 'JOUR J (live)',
  closed: 'Terminé',
};

export default function AdminHome() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/event')
      .then((r) => r.json())
      .then((d) => setEvent(d.event));
  }, []);

  async function setStatus(status: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/event', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) setEvent(data.event);
    else setMessage(data.error);
    setBusy(false);
  }

  async function resetTestData() {
    if (!confirm('Réinitialiser toutes les arrivées enregistrées ? Cette action est irréversible.')) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/reset-test-data', { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? 'Données de test réinitialisées.' : data.error);
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Administration" />

      <div className="flex-1 space-y-6 px-4 py-4">
        <div className="card">
          <p className="text-sm font-semibold text-black/50">Statut de l'événement</p>
          <p className="mt-1 text-2xl font-bold">{event ? STATUS_LABELS[event.status] : '…'}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                disabled={busy || event?.status === key}
                onClick={() => setStatus(key)}
                className={`rounded-xl2 border px-3 py-2 text-sm font-semibold ${
                  event?.status === key ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {message && <p className="mt-2 text-sm text-black/60">{message}</p>}
        </div>

        <nav className="grid grid-cols-2 gap-3">
          <AdminLink href="/admin/wizard" label="Assistant de préparation" icon="✓" />
          <AdminLink href="/admin/tables" label="Gérer les tables" icon="▦" />
          <AdminLink href="/admin/import" label="Importer les invités" icon="⇩" />
          <AdminLink href="/admin/diffusion" label="Diffuser les invitations" icon="✉" />
          <AdminLink href="/admin/qr" label="Associer les QR codes" icon="▣" />
          <AdminLink href="/admin/users" label="Comptes de l'équipe" icon="◎" />
          <AdminLink href="/dashboard" label="Tableau de bord" icon="◔" />
          <AdminLink href="/history" label="Historique" icon="≡" />
          <AdminLink href="/exceptions" label="Exceptions" icon="⚠" />
          <AdminLink href="/admin/exports" label="Exports" icon="↓" />
        </nav>

        <div className="card">
          <p className="mb-2 font-semibold">Mode test</p>
          <p className="mb-3 text-sm text-black/50">
            Simule des scans et arrivées sans risque, puis remet tout à zéro avant le jour J.
          </p>
          <button className="btn-danger w-full" disabled={busy} onClick={resetTestData}>
            RÉINITIALISER LES DONNÉES DE TEST
          </button>
        </div>
      </div>

      <BottomNav role="admin" />
    </div>
  );
}

function AdminLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="card flex flex-col items-start gap-2">
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold leading-tight">{label}</span>
    </Link>
  );
}
