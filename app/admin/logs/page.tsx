'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LogEntry {
  id: string;
  source: 'client' | 'server';
  level: 'error' | 'warn' | 'info';
  path: string | null;
  message: string;
  stack: string | null;
  digest: string | null;
  context: Record<string, unknown>;
  created_at: string;
}

const LEVEL_BADGE: Record<LogEntry['level'], string> = {
  error: 'bg-status-over text-white',
  warn: 'bg-status-partial text-white',
  info: 'bg-surface-2 text-text-muted',
};

/**
 * Lecture seule des logs applicatifs (`app_logs`, migration 0057) -- systeme
 * de logs demande par Gersom le 17/09/2026 : "que tu peux par la suite
 * analyser pour les erreurs... pour t'aider a te corriger et optimiser le
 * systeme". Admin uniquement (comme le reste de `/admin`), aucune capacite
 * dediee necessaire -- `canAccessPath` bloque deja tout non-admin sur ce
 * prefixe. Filtre par source/niveau, une carte par entree, la moins recente
 * en bas (deja trie cote API).
 */
export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'client' | 'server'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = sourceFilter !== 'all' ? '?source=' + sourceFilter : '';
    fetch('/api/admin/logs' + params, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, [sourceFilter]);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Logs applicatifs" backHref="/admin" />

      <div className="flex-1 space-y-3 px-4 py-4">
        <div className="flex gap-2">
          {(['all', 'client', 'server'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={
                'rounded-full border px-3 py-1.5 text-sm font-semibold ' +
                (sourceFilter === value ? 'border-accent bg-accent-tint text-accent' : 'border-hairline text-text-muted')
              }
            >
              {value === 'all' ? 'Toutes' : value === 'client' ? 'Navigateur' : 'Serveur'}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-text-faint">Chargement…</p>}
        {!loading && logs.length === 0 && (
          <p className="text-center text-text-faint">Aucune erreur enregistrée pour l’instant — bon signe.</p>
        )}

        <div className="space-y-2">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => setExpandedId(expanded ? null : log.id)}
                className="card block w-full space-y-1.5 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={'rounded-full px-2 py-0.5 text-xs font-bold ' + LEVEL_BADGE[log.level]}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-semibold text-text-muted">
                    {log.source === 'client' ? 'Navigateur' : 'Serveur'}
                  </span>
                  {log.path && <span className="truncate text-xs text-text-faint">{log.path}</span>}
                  <span className="ml-auto shrink-0 text-xs text-text-faint">
                    {format(new Date(log.created_at), 'd MMM HH:mm:ss', { locale: fr })}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-text">{log.message}</p>
                {expanded && (
                  <div className="mt-2 space-y-2 rounded-xl2 border border-hairline bg-surface-2 p-3 text-xs">
                    {log.stack && (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-text-muted">{log.stack}</pre>
                    )}
                    {Object.keys(log.context || {}).length > 0 && (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-text-faint">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
