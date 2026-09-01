'use client';

import { useMemo, useState } from 'react';
import { TableCapacity } from '@/lib/capacity';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

/**
 * Recherche + liste de tables avec occupation, utilisee par tout parcours
 * qui doit faire choisir une table de destination (deplacement simple,
 * deplacement en lot, choix de la table B pour un echange). Extrait de
 * l'ancien /tables/move/[invitationId] pour ne pas dupliquer cette liste
 * dans chaque nouveau parcours.
 */
export function TablePicker({
  usages,
  excludeTableId,
  selectedTableId,
  onSelect,
  minimumEstimatedFree = 0,
}: {
  usages: TableCapacity[];
  excludeTableId?: string | null;
  selectedTableId: string | null;
  onSelect: (tableId: string) => void;
  minimumEstimatedFree?: number;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = usages.filter((u) => u.table.id !== excludeTableId);
    const q = query.trim().toLowerCase();
    const sorted = [...list].sort((a, b) => b.libresMaintenant - a.libresMaintenant);
    if (!q) return sorted;
    return sorted.filter((u) => {
      const vol = volCode(u.table.number) || '';
      return (
        String(u.table.number).includes(q) ||
        (u.table.label || '').toLowerCase().includes(q) ||
        vol.toLowerCase().includes(q)
      );
    });
  }, [usages, query, excludeTableId]);

  return (
    <div className="space-y-4">
      <input
        className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3  placeholder:text-text-faint focus:border-accent focus:outline-none"
        placeholder="Rechercher une table (numéro, ville, vol…)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-text-faint">Aucune table trouvée.</p>}
        {filtered.map((u) => {
          const selected = selectedTableId === u.table.id;
          const proche = u.occupationEstimee >= u.table.capacity;
          const insufficient = u.libresEstimees < minimumEstimatedFree;
          const vol = volCode(u.table.number);
          return (
            <button
              key={u.table.id}
              type="button"
              disabled={insufficient}
              onClick={() => onSelect(u.table.id)}
              className={
                'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                (selected ? 'border-accent bg-accent-tint ' : 'border-hairline bg-surface ') +
                (insufficient ? ' cursor-not-allowed opacity-45' : '')
              }
            >
              <span className="min-w-0">
                <span className="block font-semibold">
                  Table {u.table.number}
                  {u.table.label ? ' — ' + u.table.label : ''}
                  {u.table.is_reserve ? ' (réserve)' : ''}
                </span>
                {vol && <span className="block text-xs text-text-faint">{vol}</span>}
              </span>
              <span className={'shrink-0 text-right text-sm ' + (proche ? 'text-status-over' : 'text-text-faint')}>
                <span className="block">{u.occupationEstimee} / {u.table.capacity} places prévues</span>
                <span className="block text-xs">{u.libresMaintenant} libre{u.libresMaintenant > 1 ? 's' : ''} maintenant</span>
                {insufficient && <span className="block text-xs font-semibold">Capacité insuffisante</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
