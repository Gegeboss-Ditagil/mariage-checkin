'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { StaffIcon } from '@/components/icons';
import { hasCapability } from '@/lib/permissions';
import { usePolling } from '@/hooks/usePolling';
import type { Role } from '@/lib/types';

type AgendaItem = { id: string; time_label: string; title: string; completed: boolean };

/**
 * Bande compacte juste au-dessus du raccourci Approbations sur /scan --
 * demande de Gersom le 02/09/2026 : "un bouton qui ramène à l'agenda, mais
 * qui affiche directement c'est quoi la prochaine activité du chronogramme
 * ... rapidement la personne voit c'est quoi la prochaine étape". Réservée
 * à admin/directeur (capacité viewAgenda, même accès que l'onglet Agenda) :
 * placeur/agent_checkin n'ont pas accès à /agenda.
 *
 * "Prochaine activité" = la première non cochée "terminé" dans l'ordre du
 * chronogramme -- pas une comparaison à l'heure de l'appareil, qui casserait
 * sur les activités après minuit (01:00, 03:00, 05:00) et ne refléterait
 * pas un déroulement en avance/en retard sur l'horaire prévu.
 */
export function NextAgendaActivity({ role }: { role: Role }) {
  const [next, setNext] = useState<AgendaItem | null | undefined>(undefined);

  const loadNext = useCallback(async () => {
    const response = await fetch('/api/agenda', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    const items = (data.items || []) as AgendaItem[];
    setNext(items.find((item) => !item.completed) ?? null);
  }, []);

  const canPollAgenda = hasCapability(role, 'viewAgenda');

  useEffect(() => {
    if (!canPollAgenda) return;
    void loadNext();
  }, [loadNext, canPollAgenda]);

  // Sondage maille a la visibilite de l'onglet (voir hooks/usePolling.ts).
  usePolling(loadNext, canPollAgenda ? 30000 : 0);

  if (!hasCapability(role, 'viewAgenda') || next === undefined) return null;

  return (
    <Link
      href="/agenda"
      className="mx-auto mb-3 flex min-h-14 w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center gap-3 rounded-2xl border border-hairline bg-glass px-5 py-3 shadow-card backdrop-blur-xl transition-transform active:scale-[0.98] landscape:mx-2 landscape:w-auto landscape:max-w-none"
    >
      <StaffIcon className="h-6 w-6 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">Prochaine activité</p>
        {next ? (
          <p className="truncate text-sm font-semibold text-text">
            <span className="font-bold tabular-nums text-accent">{next.time_label}</span> · {next.title}
          </p>
        ) : (
          <p className="text-sm font-semibold text-text-muted">Chronogramme terminé</p>
        )}
      </div>
    </Link>
  );
}
