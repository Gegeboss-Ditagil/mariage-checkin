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

  // Interrupteur Twilio (SMS/WhatsApp de l'approbation d'invité surprise) --
  // retour de Gersom le 16/09/2026 : remplace l'ancien toggle par variable
  // d'environnement TWILIO_ENABLED (v1.48.3, réservé à un accès Vercel) par
  // un bouton accessible directement depuis cette page (events.twilio_enabled,
  // migration 0055) — "ce problème sera rapidement réglé là". Tant que
  // désactivé (par défaut), aucune requête réseau Twilio n'est tentée et
  // l'agent qui soumet une demande ne voit plus aucun message à ce sujet.
  async function toggleTwilio() {
    if (!event) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/event', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twilio_enabled: !event.twilio_enabled }),
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg landscape:flex-row landscape:bottom-[env(safe-area-inset-bottom)]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Administration" />

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div className="card">
            <p className="text-sm font-semibold text-text-faint">Statut de l'événement</p>
            <p className="mt-1 text-2xl font-bold">{event ? STATUS_LABELS[event.status] : '…'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  disabled={busy || event?.status === key}
                  onClick={() => setStatus(key)}
                  className={`rounded-xl2 border px-3 py-2 text-sm font-semibold ${
                    event?.status === key ? 'border-accent bg-accent text-on-accent' : 'border-hairline bg-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {message && <p className="mt-2 text-sm text-text-muted">{message}</p>}
          </div>

          <nav className="grid grid-cols-2 gap-3">
            <AdminLink href="/admin/wizard" label="Assistant de préparation" icon="✓" />
            <AdminLink href="/admin/tables" label="Gérer les tables" icon="▦" />
            <AdminLink href="/admin/import-withjoy" label="Importer depuis With Joy" icon="⟳" />
            <AdminLink href="/admin/users" label="Comptes de l'équipe" icon="◎" />
            <AdminLink href="/dashboard" label="Tableau de bord" icon="◔" />
            <AdminLink href="/history" label="Historique" icon="≡" />
            <AdminLink href="/exceptions" label="Exceptions" icon="⚠" />
            <AdminLink href="/admin/exports" label="Exports" icon="↓" />
          </nav>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">SMS/WhatsApp (Twilio)</p>
                <p className="mt-0.5 text-sm text-text-faint">
                  Confirmation à l'approbateur et rapport aux directeurs de festin pour les invités surprise.
                  {event && !event.twilio_enabled && ' Désactivé : aucun message n\'est envoyé, et aucune erreur ne s\'affiche à ce sujet.'}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={event?.twilio_enabled ?? false}
                aria-label="Activer ou désactiver Twilio"
                disabled={busy || !event}
                className={'shrink-0 glass-toggle' + (event?.twilio_enabled ? ' glass-toggle-on' : '')}
                onClick={toggleTwilio}
              >
                <span aria-hidden className={'glass-toggle-thumb' + (event?.twilio_enabled ? ' glass-toggle-thumb-on' : '')} />
              </button>
            </div>
          </div>

          <div className="card">
            <p className="mb-2 font-semibold">Mode test</p>
            <p className="mb-3 text-sm text-text-faint">
              Simule des scans et arrivées sans risque, puis remet tout à zéro avant le jour J.
            </p>
            <button className="btn-danger w-full" disabled={busy} onClick={resetTestData}>
              RÉINITIALISER LES DONNÉES DE TEST
            </button>
          </div>
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
