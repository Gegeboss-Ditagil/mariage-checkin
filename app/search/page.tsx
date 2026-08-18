'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';

interface Result extends InvitationRow {
  table?: TableRow | null;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();

      // Recherche tolerante : nom_affichage OU groupe contient le texte,
      // ou le numero de table (si l'utilisateur tape un chiffre).
      const numeric = /^\d+$/.test(q);

      let invitationsQuery = supabase
        .from('invitations')
        .select('*, table:tables(*)')
        .limit(25);

      if (numeric) {
        const { data: tables } = await supabase.from('tables').select('id').eq('number', Number(q));
        const tableIds = (tables || []).map((t) => t.id);
        invitationsQuery = invitationsQuery.in('table_id', tableIds.length ? tableIds : ['__none__']);
      } else {
        invitationsQuery = invitationsQuery.or(
          `nom_affichage.ilike.%${q}%,groupe.ilike.%${q}%`
        );
      }

      const { data } = await invitationsQuery;
      setResults((data as Result[]) || []);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Rechercher un invité" backHref="/scan" />

      <div className="px-4 pt-3">
        <input
          autoFocus
          className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
          placeholder="Prénom, nom, groupe, n° de table…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p className="p-4 text-center text-black/40">Recherche…</p>}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="p-6 text-center text-black/50">Aucun résultat pour « {query} »</p>
      )}

      <ul className="mt-2 flex-1 divide-y divide-black/5 px-4">
        {results.map((r) => (
          <li key={r.id}>
            <button
              className="flex w-full items-center justify-between gap-3 py-4 text-left"
              onClick={() => router.push(`/checkin/${r.id}`)}
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{r.nom_affichage}</p>
                <p className="text-sm text-black/50">
                  {r.table ? `Table ${r.table.number}` : 'Sans table'} · {r.nombre_prevu} personne
                  {r.nombre_prevu > 1 ? 's' : ''}
                </p>
              </div>
              <StatusBadge statut={r.statut} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
