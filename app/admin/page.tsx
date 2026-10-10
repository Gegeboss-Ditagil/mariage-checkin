'use client';

import { useEffect, useState } from 'react';
import { Link } from 'next-view-transitions';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { EventRow } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  setup: 'Préparation',
  test: 'Mode test',
  live: 'JOUR J (live)',
  closed: 'Terminé',
};

// v1.79.0, question de Gersom : « c'est quoi la différence entre les
// différents modes ? ». Le mode ne change PAS ce que les agents peuvent faire
// (scanner, pointer, approuver marchent partout) : il dit seulement si le
// bouton rouge de réinitialisation est permis.
const STATUS_HELP: Record<string, string> = {
  setup: 'Avant les essais : import With Joy, tables, comptes. La réinitialisation est permise.',
  test: 'Les agents s’entraînent pour de vrai (scans, arrivées, invités surprise). Le bouton rouge efface ensuite tout ce qu’ils ont fait.',
  live: 'Le jour J. Tout fonctionne pareil, mais le bouton rouge est bloqué : impossible d’effacer les vraies arrivées par erreur.',
  closed: 'Après la fête : consultation et exports. La réinitialisation est permise.',
};

const RESET_ERRORS: Record<string, string> = {
  event_live: 'Refusé : l’événement est en mode JOUR J. Repassez d’abord en « Mode test », puis réessayez.',
  event_not_found: 'Événement introuvable.',
};

export default function AdminHome() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // v1.75.0 : contrôle de santé de la base (voir /api/admin/health).
  const [health, setHealth] = useState<{ check_name: string; ok: boolean; detail: string }[] | null>(null);

  async function loadHealth() {
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth(Array.isArray(data.checks) ? data.checks : []);
    } catch {
      setHealth(null);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    fetch('/api/admin/event')
      .then((r) => r.json())
      .then((d) => setEvent(d.event));
  }, []);

  async function setStatus(status: string) {
    // v1.76.0 (balayage « clique partout ») : changer de mode d'un seul
    // toucher pouvait sortir du « JOUR J » -- ce qui rouvre la
    // réinitialisation des arrivées. Toujours confirmer.
    if (event && status === event.status) return;
    if (!window.confirm(`Passer l'événement en mode « ${STATUS_LABELS[status] ?? status} » ?`)) return;
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
    if (!confirm('Effacer tout ce qui a été fait pendant les essais ?\n\n• toutes les arrivées et tous les scans\n• les personnes ajoutées sur place (+)\n• les invités surprise et leurs demandes d’approbation\n• l’historique et les exceptions\n\nLes invités importés de With Joy, leurs tables et les comptes restent. Action irréversible.')) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/reset-test-data', { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? 'Données de test effacées : tout est prêt pour le jour J.' : RESET_ERRORS[data.error] ?? data.error);
    setBusy(false);
  }

  return (
    <div className="fixed inset-x-0 top-0 flex h-[100svh] flex-col overflow-hidden bg-bg landscape:flex-row landscape:h-[calc(100svh-env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Administration" backHref="/dashboard" />

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
            {event && STATUS_HELP[event.status] && <p className="mt-3 text-sm text-text-faint">{STATUS_HELP[event.status]}</p>}
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
            <AdminLink href="/admin/logs" label="Logs applicatifs" icon="🛠" />
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
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-semibold">Santé de la base</p>
              <button type="button" className="glass-pill text-sm" onClick={() => void loadHealth()}>
                Revérifier
              </button>
            </div>
            {health === null ? (
              <p className="text-sm text-text-faint">Vérification…</p>
            ) : health.filter((c) => !c.ok).length === 0 ? (
              <p className="text-sm text-status-complete">✓ {health.length} contrôles OK : fonctions, colonnes et données cohérentes.</p>
            ) : (
              <ul className="space-y-1.5">
                {health.filter((c) => !c.ok).map((c) => (
                  <li key={c.check_name} className="text-sm">
                    <span className="font-semibold text-status-over">✕ {c.check_name}</span>
                    <span className="block text-text-faint">{c.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <p className="mb-2 font-semibold">Mode test</p>
            <p className="mb-3 text-sm text-text-faint">
              Efface tout ce que les agents ont fait pendant les essais (arrivées, scans, ajouts sur place, invités surprise), pour commencer le jour J au propre. Les invités With Joy, les tables et les comptes restent.
            </p>
            <button className="btn-danger w-full" disabled={busy || event?.status === 'live'} onClick={resetTestData}>
              RÉINITIALISER LES DONNÉES DE TEST
            </button>
            {event?.status === 'live' && (
              <p className="mt-2 text-sm font-medium text-status-partial">
                Bloqué en mode JOUR J. Pour effacer les essais, repassez d’abord en « Mode test ».
              </p>
            )}
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
