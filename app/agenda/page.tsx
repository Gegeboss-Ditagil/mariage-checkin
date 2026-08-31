'use client';

import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import { TopBar } from '@/components/TopBar';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { EVENT_AGENDA } from '@/lib/eventAgenda';

export default function AgendaPage() {
  const role = useSessionRole();

  if (role && !hasCapability(role, 'viewAgenda')) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-sm text-text-muted">Agenda réservé aux administrateurs et directeurs de festin.</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Agenda du jour J" backHref="/dashboard" />
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="card mb-4 space-y-2">
            <p className="eyebrow">Samedi 24 octobre 2026</p>
            <h1 className="font-display text-xl">Chronogramme de la cérémonie</h1>
            <p className="text-sm text-text-muted">
              Première transcription du document Canva. Les responsables, shifts et validations « fait » seront ajoutés dès réception de la liste complète des agents.
            </p>
            <Link href="/staff" className="action-row mt-3">Voir les personnes du staff</Link>
          </div>

          <ol className="space-y-2" aria-label="Chronogramme du mariage">
            {EVENT_AGENDA.map((item) => (
              <li key={item.time + item.title} className="card flex gap-3 py-3">
                <time className="w-20 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-accent">{item.time}</time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {item.department}
                    </span>
                  </div>
                  {item.details && <p className="mt-1 text-xs leading-relaxed text-text-faint">{item.details}</p>}
                  <p className="mt-2 text-xs font-medium text-status-partial">Responsable à attribuer</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {role && <BottomNav role={role} />}
    </div>
  );
}
