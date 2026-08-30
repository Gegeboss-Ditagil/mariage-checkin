'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { format } from 'date-fns';
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

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Historique" />

      {loading && <p className="p-4 text-center text-text-faint">Chargement…</p>}

      <ul className="flex-1 divide-y divide-hairline px-4">
        {entries.map((e) => (
          <li key={e.id} className="py-3">
            <div className="flex items-center justify-between text-sm text-text-faint">
              <span>{format(new Date(e.created_at), 'HH:mm:ss', { locale: fr })}</span>
              <span>{e.agent_name || '—'}</span>
            </div>
            <p className="font-medium">
              {e.details?.nom_affichage || '—'}{' '}
              {e.action === 'checkin' && (
                <span className="text-status-complete">
                  {(e.nouveau_total ?? 0) - (e.ancien_total ?? 0) >= 0 ? '+' : ''}
                  {(e.nouveau_total ?? 0) - (e.ancien_total ?? 0)} personnes
                </span>
              )}
              {e.action === 'correction' && <span className="text-status-partial">correction → {e.nouveau_total}</span>}
              {e.action === 'overflow_assign' && (
                <span className="text-status-over">
                  +{e.nombre_personnes} → Table {e.reserve_table_number}
                </span>
              )}
            </p>
            {e.table_number && <p className="text-xs text-text-faint">Table {e.table_number}</p>}
          </li>
        ))}
      </ul>

      {role && <BottomNav role={role} />}
    </div>
  );
}
