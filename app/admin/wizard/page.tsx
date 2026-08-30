'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { EventRow } from '@/lib/types';

interface WizardStats {
  tablesTotal: number;
  tablesNormales: number;
  tablesReserve: number;
  tablesSansCapacite: number;
  capaciteTotale: number;
  invitationsTotal: number;
  invitationsSansTable: number;
  prevuTotal: number;
  qrTotal: number;
  qrManquants: number;
  agents: number;
  placeurs: number;
  admins: number;
}

export default function WizardPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [stats, setStats] = useState<WizardStats | null>(null);
  const [nom, setNom] = useState('');
  const [date, setDate] = useState('');
  const [reserveCap, setReserveCap] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/wizard-status')
      .then((r) => r.json())
      .then((d) => {
        setEvent(d.event);
        setStats(d.stats);
        if (d.event) {
          setNom(d.event.name ?? '');
          setDate(d.event.event_date ? String(d.event.event_date).slice(0, 10) : '');
          setReserveCap(d.event.reserve_table_capacity ?? 10);
        }
      });
  }

  useEffect(load, []);

  async function patchEvent(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/event', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMessage(`Erreur : ${data.error}`);
    load();
  }

  if (!stats || !event) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Assistant de préparation" backHref="/admin" />
        <p className="px-4 py-6 text-sm text-text-faint">Chargement…</p>
      </div>
    );
  }

  const step1Done = Boolean(event.name && event.name.trim() && event.name !== 'Nouvel événement');
  const step2Done = stats.tablesTotal > 0;
  const step3Done = stats.tablesReserve > 0 && Boolean(event.reserve_table_capacity);
  const step4Done = stats.tablesTotal > 0 && stats.tablesSansCapacite === 0;
  const step5Done = stats.invitationsTotal > 0;
  const step6Done = stats.invitationsTotal > 0 && stats.invitationsSansTable === 0;
  const step7Done = stats.tablesTotal > 0 && stats.qrManquants === 0;
  const step8Done = stats.agents >= 1 && stats.placeurs >= 1;
  const step9Done = stats.tablesTotal > 0 && stats.capaciteTotale >= stats.prevuTotal;
  const step10Done = event.status === 'live' || event.status === 'closed';

  const steps = [
    step1Done, step2Done, step3Done, step4Done, step5Done,
    step6Done, step7Done, step8Done, step9Done, step10Done,
  ];
  const doneCount = steps.filter(Boolean).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Assistant de préparation" backHref="/admin" />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card">
          <p className="text-sm font-semibold text-text-faint">Avancement</p>
          <p className="mt-1 text-2xl font-bold">{doneCount} / 10 étapes</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneCount / 10) * 100}%` }} />
          </div>
          {message && <p className="mt-2 text-sm text-status-over">{message}</p>}
        </div>

        <Step n={1} title="Nommer l'événement" done={step1Done}>
          <div className="space-y-2">
            <input
              className="w-full rounded-xl2 border border-hairline px-3 py-2.5"
              placeholder="Nom de l'événement (ex: Mariage Nelly & Gersom)"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
            <input
              type="date"
              className="w-full rounded-xl2 border border-hairline px-3 py-2.5"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              className="btn-secondary w-full"
              disabled={busy || !nom.trim()}
              onClick={() => patchEvent({ name: nom, event_date: date || null })}
            >
              Enregistrer
            </button>
          </div>
        </Step>

        <Step n={2} title="Créer les tables" done={step2Done} detail={`${stats.tablesTotal} table(s) créée(s) (${stats.tablesNormales} normales + ${stats.tablesReserve} réserve)`}>
          <Link href="/admin/tables" className="btn-secondary block w-full text-center">
            Gérer les tables
          </Link>
        </Step>

        <Step
          n={3}
          title="Définir la capacité des tables de réserve"
          done={step3Done}
          detail={`Capacité de réserve par défaut : ${event.reserve_table_capacity ?? '—'}`}
        >
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              className="w-24 rounded-xl2 border border-hairline px-3 py-2.5"
              value={reserveCap}
              onChange={(e) => setReserveCap(Number(e.target.value))}
            />
            <button className="btn-secondary flex-1" disabled={busy} onClick={() => patchEvent({ reserve_table_capacity: reserveCap })}>
              Enregistrer
            </button>
          </div>
        </Step>

        <Step
          n={4}
          title="Vérifier la capacité de chaque table"
          done={step4Done}
          detail={
            stats.tablesSansCapacite > 0
              ? `${stats.tablesSansCapacite} table(s) sans capacité définie`
              : 'Toutes les tables ont une capacité'
          }
        >
          <Link href="/admin/tables" className="btn-secondary block w-full text-center">
            Vérifier les tables
          </Link>
        </Step>

        <Step n={5} title="Importer les invités" done={step5Done} detail={`${stats.invitationsTotal} invitation(s) importée(s)`}>
          <Link href="/admin/import" className="btn-secondary block w-full text-center">
            Importer un CSV / XLSX
          </Link>
        </Step>

        <Step
          n={6}
          title="Associer chaque invitation à une table"
          done={step6Done}
          detail={
            stats.invitationsSansTable > 0
              ? `${stats.invitationsSansTable} invitation(s) sans table assignée`
              : 'Toutes les invitations ont une table'
          }
        >
          <Link href="/admin/import" className="btn-secondary block w-full text-center">
            Corriger via l'import
          </Link>
        </Step>

        <Step
          n={7}
          title="Associer un QR code à chaque table"
          done={step7Done}
          detail={`${stats.qrTotal} QR associé(s)${stats.qrManquants > 0 ? ` — ${stats.qrManquants} table(s) sans QR` : ''}`}
        >
          <Link href="/admin/qr" className="btn-secondary block w-full text-center">
            Associer les QR codes
          </Link>
        </Step>

        <Step
          n={8}
          title="Créer les comptes agents et placeurs"
          done={step8Done}
          detail={`${stats.admins} admin(s), ${stats.agents} agent(s), ${stats.placeurs} placeur(s)`}
        >
          <Link href="/admin/users" className="btn-secondary block w-full text-center">
            Gérer les comptes
          </Link>
        </Step>

        <Step
          n={9}
          title="Vérifier la capacité totale vs invités prévus"
          done={step9Done}
          detail={`Capacité totale : ${stats.capaciteTotale} — invités prévus : ${stats.prevuTotal}`}
        >
          {!step9Done && (
            <p className="text-sm text-status-over">
              La capacité totale des tables est inférieure au nombre d'invités prévus. Ajustez les capacités ou ajoutez des
              tables.
            </p>
          )}
        </Step>

        <Step
          n={10}
          title="Tester un scan, puis passer en Mode Test / Jour J"
          done={step10Done}
          detail={`Statut actuel : ${event.status}`}
        >
          <div className="grid grid-cols-2 gap-2">
            <Link href="/scan" className="btn-secondary text-center">
              Tester un scan
            </Link>
            <Link href="/admin" className="btn-secondary text-center">
              Changer le statut
            </Link>
          </div>
        </Step>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  detail,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? 'bg-status-complete text-white' : 'bg-surface-2 text-text-faint'
          }`}
        >
          {done ? '✓' : n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{title}</p>
          {detail && <p className="mt-0.5 text-sm text-text-faint">{detail}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
