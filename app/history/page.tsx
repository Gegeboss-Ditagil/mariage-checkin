'use client';

import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  nombre_personnes: number | null;
  ancien_total: number | null;
  nouveau_total: number | null;
  details: { nom_affichage?: string } | null;
  table_number: number | null;
  reserve_table_number: number | null;
  agent_name: string | null;
}

export default function HistoryPage() {
  const role = useSessionRole();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .finally(() => setLoading(false));
  }, []);

  // Regroupe par jour calendaire (maquette : "CE SOIR · 96 ACTIONS" en
  // en-tete de section) -- les entrees arrivent deja triees du plus recent
  // au plus ancien (voir app/api/history/route.ts), un simple decoupage
  // sequentiel suffit, pas besoin de re-trier.
  const groups = useMemo(() => {
    const byDay: { key: string; label: string; entries: HistoryEntry[] }[] = [];
    for (const e of entries) {
      const d = new Date(e.created_at);
      const key = format(d, 'yyyy-MM-dd');
      const last = byDay[byDay.length - 1];
      if (last && last.key === key) {
        last.entries.push(e);
        continue;
      }
      const label = isToday(d) ? 'Ce soir' : isYesterday(d) ? 'Hier' : format(d, 'd MMMM', { locale: fr });
      byDay.push({ key, label, entries: [e] });
    }
    return byDay;
  }, [entries]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar title="Historique" />

      {loading && <p className="p-4 text-center text-text-faint">Chargement…</p>}

      <div className="flex-1 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-text-faint dark:text-accent">
            {group.label} · {group.entries.length} action{group.entries.length > 1 ? 's' : ''}
          </p>
          <ul className="divide-y divide-hairline px-4">
            {group.entries.map((e) => {
              // Meme code couleur que le detail de l'action ci-dessous
              // (pastille + montant), plutot que d'inventer une 4e couleur :
              // arrivee = vert, exces place en reserve = rouge, correction =
              // neutre (pas status-partial/ambre -- une correction n'est pas
              // un avertissement operationnel comme une table partiellement
              // remplie).
              const dotClass =
                e.action === 'checkin'
                  ? 'bg-status-complete'
                  : e.action === 'overflow_assign'
                    ? 'bg-status-over'
                    : 'bg-status-none';
              return (
                <li key={e.id} className="py-3">
                  <div className="flex items-center justify-between text-sm text-text-faint">
                    <span>{format(new Date(e.created_at), 'HH:mm:ss', { locale: fr })}</span>
                    <span>{e.agent_name || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      <span aria-hidden className={'mr-1.5 inline-block h-2 w-2 rounded-full align-middle ' + dotClass} />
                      {e.details?.nom_affichage || '—'}
                      {e.table_number && (
                        <span className="block text-xs font-normal text-text-faint">Table {e.table_number}</span>
                      )}
                    </p>
                    <p className="shrink-0 text-right text-sm font-semibold">
                      {e.action === 'checkin' && (
                        <span className="text-status-complete">
                          {(e.nouveau_total ?? 0) - (e.ancien_total ?? 0) >= 0 ? '+' : ''}
                          {(e.nouveau_total ?? 0) - (e.ancien_total ?? 0)} personnes
                        </span>
                      )}
                      {e.action === 'correction' && (
                        <span className="text-text-faint">correction → {e.nouveau_total}</span>
                      )}
                      {e.action === 'overflow_assign' && (
                        <span className="text-status-over">
                          +{e.nombre_personnes} → Table {e.reserve_table_number}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}
