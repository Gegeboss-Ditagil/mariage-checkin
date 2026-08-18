'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';

interface Result extends InvitationRow {
  table?: TableRow | null;
}

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

function extractPrenoms(notes: string | null): string | null {
  if (!notes) return null;
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return null;
  const noms = after
    .split(',')
    .map(function (part) {
      const trimmed = part.trim();
      const premierMot = trimmed.split(' ')[0];
      return premierMot;
    })
    .filter(Boolean);
  if (noms.length === 0) return null;
  return noms.join(', ');
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [allTables, setAllTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Les tables changent rarement pendant l'evenement : on les charge une
  // seule fois, puis on filtre cote client (plus rapide, et permet de
  // chercher par numero ET par nom de ville/vol en meme temps).
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tables')
      .select('*')
      .order('number')
      .then(({ data }) => setAllTables((data as TableRow[]) || []));
  }, []);

  const tableResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return allTables
      .filter((t) => {
        const vol = volCode(t.number) || '';
        return (
          String(t.number).includes(q) ||
          (t.label || '').toLowerCase().includes(q) ||
          (t.zone || '').toLowerCase().includes(q) ||
          vol.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [allTables, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();

      // Recherche tolerante : nom_affichage, groupe, les prenoms stockes dans
      // notes ("Membres: ..."), l'email, ET le telephone — le telephone est
      // compare uniquement sur les chiffres, sur la FIN du numero (au moins 5
      // chiffres), pour ignorer les differences d'indicatif pays (+33, 0033,
      // 0 initial manquant, etc.).
      const digits = q.replace(/\D/g, '');
      const digitSuffix = digits.length >= 5 ? digits.slice(-8) : null;

      const orParts = [
        'nom_affichage.ilike.%' + q + '%',
        'groupe.ilike.%' + q + '%',
        'notes.ilike.%' + q + '%',
        'email.ilike.%' + q + '%',
      ];
      if (digitSuffix) {
        orParts.push('telephone_digits.ilike.%' + digitSuffix + '%');
      }

      const { data } = await supabase
        .from('invitations')
        .select('*, table:tables(*)')
        .or(orParts.join(','))
        .limit(25);

      setResults((data as Result[]) || []);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const hasQuery = query.trim().length >= 2;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Rechercher un invité" backHref="/scan" />

      <div className="px-4 pt-3">
        <input
          autoFocus
          className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-800 px-4 py-3.5 text-lg text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
          placeholder="Prénom, nom, table, téléphone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p className="p-4 text-center text-cream/40">Recherche…</p>}

      {!loading && hasQuery && tableResults.length === 0 && results.length === 0 && (
        <p className="p-6 text-center text-cream/50">Aucun résultat pour « {query} »</p>
      )}

      {tableResults.length > 0 && (
        <div className="px-4 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/40">Tables</p>
          <div className="space-y-2">
            {tableResults.map((t) => {
              const vol = volCode(t.number);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center justify-between rounded-xl2 border-2 border-gold-400/20 bg-night-800 px-4 py-3 text-left"
                  onClick={() => router.push('/tables/' + t.id)}
                >
                  <span>
                    <span className="block font-semibold text-cream">
                      Table {t.number}
                      {t.label ? ' — ' + t.label : ''}
                    </span>
                    {vol && <span className="block text-xs text-cream/40">{vol}</span>}
                  </span>
                  {t.is_reserve && <span className="text-xs text-status-partial">Réserve</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-2 px-4">
          {tableResults.length > 0 && (
            <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-cream/40">Invités</p>
          )}
          <ul className="flex-1 divide-y divide-gold-400/10">
            {results.map((r) => {
              const prenoms = extractPrenoms(r.notes);
              return (
                <li key={r.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-4 text-left"
                    onClick={() => router.push('/checkin/' + r.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{r.nom_affichage}</p>
                      {prenoms && <p className="truncate text-xs font-medium text-gold-300">{prenoms}</p>}
                      <p className="text-sm text-cream/50">
                        {r.table ? 'Table ' + r.table.number : 'Sans table'} · {r.nombre_prevu} personne
                        {r.nombre_prevu > 1 ? 's' : ''}
                      </p>
                    </div>
                    <StatusBadge statut={r.statut} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
