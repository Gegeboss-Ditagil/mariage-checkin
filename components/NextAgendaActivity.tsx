'use client';

import { Link } from 'next-view-transitions';
import { useCallback, useEffect, useState } from 'react';
import { StaffIcon } from '@/components/icons';
import { hasCapability } from '@/lib/permissions';
import { usePolling } from '@/hooks/usePolling';
import { montrealMinutes, pickNextActivity } from '@/lib/agendaSchedule';
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
 * "Prochaine activité" (v1.82.3, retour de Gersom : « basée sur l'heure ») =
 * la première activité du chronogramme, non cochée "terminé", qui n'est pas
 * déjà passée selon l'heure de Montréal -- voir lib/agendaSchedule.ts, qui
 * gère les lignes après minuit (23:30–00:00, 00:40, 03:00, 05:00). Une
 * ligne déjà commencée s'affiche « En cours ». Cocher une ligne la saute
 * toujours, ce qui permet de rattraper un déroulement en avance.
 */
export function NextAgendaActivity({ role }: { role: Role }) {
  const [items, setItems] = useState<AgendaItem[] | undefined>(undefined);
  const [nowMinutes, setNowMinutes] = useState(() => montrealMinutes(new Date()));

  const loadNext = useCallback(async () => {
    const response = await fetch('/api/agenda', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    setItems((data.items || []) as AgendaItem[]);
    setNowMinutes(montrealMinutes(new Date()));
  }, []);

  const canPollAgenda = hasCapability(role, 'viewAgenda');

  useEffect(() => {
    if (!canPollAgenda) return;
    void loadNext();
  }, [loadNext, canPollAgenda]);

  // Sondage maille a la visibilite de l'onglet (voir hooks/usePolling.ts).
  usePolling(loadNext, canPollAgenda ? 30000 : 0);

  if (!hasCapability(role, 'viewAgenda')) return null;

  const picked = items === undefined ? undefined : pickNextActivity(items, nowMinutes);
  const next = picked?.item ?? null;

  return (
    <Link
      href="/agenda"
      className="mx-auto mb-3 flex min-h-14 w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center gap-3 rounded-2xl border border-hairline bg-glass px-5 py-3 shadow-card backdrop-blur-xl transition-transform active:scale-[0.98] landscape:mx-2 landscape:w-auto landscape:max-w-none"
    >
      <StaffIcon className="h-6 w-6 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-faint">{picked?.inProgress ? 'En cours' : 'Prochaine activité'}</p>
        {picked === undefined ? (
          <p className="text-sm font-semibold text-text-faint">Chargement…</p>
        ) : next ? (
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
