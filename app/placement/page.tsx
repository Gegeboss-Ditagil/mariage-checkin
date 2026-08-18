'use client';

import { useState } from 'react';
import { QrScanner } from '@/components/QrScanner';
import { createClient } from '@/lib/supabase/client';
import { TableRow } from '@/lib/types';

// Enleve les accents, la casse et la ponctuation pour comparer des noms de
// ville de facon tolerante (ex: "GENEVE" doit correspondre a "Geneve").
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export default function PlacementPage() {
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [query, setQuery] = useState('');
  const [table, setTable] = useState<TableRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolveByCode(raw: string) {
    setError(null);
    let code = raw.trim();
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      code = parts[parts.length - 1] || raw;
    } catch {
      /* pas une URL */
    }

    const supabase = createClient();
    const { data: qr } = await supabase.from('qr_codes').select('table_id').ilike('code', code).maybeSingle();
    if (qr) {
      const { data: t } = await supabase.from('tables').select('*').eq('id', qr.table_id).maybeSingle();
      setTable(t as TableRow | null);
      return;
    }

    // Repli : certaines cartes imprimees encodent le nom de la ville
    // (accents/casse variables) plutot que le code vol-tXXX.
    const { data: allTables } = await supabase.from('tables').select('*');
    const normalizedCode = normalize(code);
    const match = ((allTables as TableRow[]) || []).find((t) => t.label && normalize(t.label) === normalizedCode);
    if (match) {
      setTable(match);
      return;
    }

    setError('QR non reconnu');
  }

  async function resolveBySearch() {
    setError(null);
    const supabase = createClient();

    if (/^\d+$/.test(query.trim())) {
      const { data: t } = await supabase.from('tables').select('*').eq('number', Number(query)).maybeSingle();
      if (t) return setTable(t as TableRow);
    }

    const { data: inv } = await supabase
      .from('invitations')
      .select('table_id')
      .ilike('nom_affichage', '%' + query + '%')
      .limit(1)
      .maybeSingle();

    if (!inv?.table_id) {
      setError('Introuvable');
      return;
    }
    const { data: t } = await supabase.from('tables').select('*').eq('id', inv.table_id).maybeSingle();
    setTable(t as TableRow | null);
  }

  if (table) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink text-white">
        <p className="text-2xl uppercase tracking-widest text-white/60">Table</p>
        <p className="text-[9rem] font-bold leading-none">{table.number}</p>
        {table.zone && <p className="text-2xl text-white/70">{table.zone}</p>}
        <button
          className="btn-secondary mt-8 w-56 bg-white/10 text-white"
          onClick={() => {
            setTable(null);
            setQuery('');
          }}
        >
          Invité suivant
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl">Placement</h1>
      </div>

      <div className="mb-4 mt-3 flex px-4">
        <button
          className={'flex-1 rounded-l-xl2 border py-2.5 text-sm font-semibold ' + (mode === 'scan' ? 'bg-ink text-white' : 'bg-white')}
          onClick={() => setMode('scan')}
        >
          Scan QR
        </button>
        <button
          className={'flex-1 rounded-r-xl2 border py-2.5 text-sm font-semibold ' + (mode === 'search' ? 'bg-ink text-white' : 'bg-white')}
          onClick={() => setMode('search')}
        >
          Recherche
        </button>
      </div>

      {mode === 'scan' ? (
        <div className="px-4">
          <QrScanner onScan={resolveByCode} />
        </div>
      ) : (
        <div className="space-y-3 px-4">
          <input
            autoFocus
            className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
            placeholder="Nom ou n° de table"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-primary w-full" onClick={resolveBySearch}>
            Rechercher
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-center font-medium text-status-over">{error}</p>}
    </div>
  );
}
