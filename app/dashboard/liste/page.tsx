'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Cote, InvitationRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';

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

const TITRES: Record<string, string> = {
  tous: 'Tous les invités',
  arrives: 'Invités arrivés',
  restants: 'Invités restants',
  complet: 'Invitations complètes',
  partiel: 'Invitations partielles',
  non_arrive: 'Invitations non arrivées',
  supplementaire: 'Invitations en excédent',
};

function filtreInvitation(type: string, inv: InvitationRow): boolean {
  if (type === 'arrives') return inv.nombre_arrive > 0;
  if (type === 'restants') return inv.nombre_arrive < inv.nombre_prevu;
  if (type === 'complet') return inv.statut === 'complet';
  if (type === 'partiel') return inv.statut === 'partiel';
  if (type === 'non_arrive') return inv.statut === 'non_arrive';
  if (type === 'supplementaire') return inv.nombre_arrive > inv.nombre_prevu;
  return true;
}

// Le nombre pertinent dépend de la liste affichée : arrivés, restants,
// supplémentaires ou total prévu. La même règle alimente le total et la
// répartition par côté afin que les cartes restent cohérentes entre elles.
function comptePersonnes(type: string, inv: InvitationRow): number {
  if (type === 'restants') return Math.max(0, inv.nombre_prevu - inv.nombre_arrive);
  if (type === 'supplementaire') return Math.max(0, inv.nombre_arrive - inv.nombre_prevu);
  if (type === 'arrives') return inv.nombre_arrive;
  return inv.nombre_prevu;
}

export default function DashboardListePage() {
  return (
    <Suspense fallback={null}>
      <ListeContent />
    </Suspense>
  );
}

function ListeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get('type') || 'tous';

  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: invs }, { data: tbls }] = await Promise.all([
        supabase.from('invitations').select('*').order('nom_affichage'),
        supabase.from('tables').select('*'),
      ]);
      if (!active) return;
      setInvitations((invs as InvitationRow[]) || []);
      setTables((tbls as TableRow[]) || []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const tableParId = new Map(tables.map((t) => [t.id, t]));
  const filtres = invitations.filter((inv) => filtreInvitation(type, inv));
  const totalPersonnes = filtres.reduce((s, i) => s + i.nombre_arrive, 0);
  const titre = TITRES[type] || 'Invités';

  const parCote = useMemo(() => {
    const totaux: Record<Cote, number> = { Nelly: 0, Gege: 0, Neutre: 0 };
    for (const inv of filtres) {
      if (inv.cote) totaux[inv.cote] += comptePersonnes(type, inv);
    }
    return totaux;
  }, [filtres, type]);
  const totalParCote = filtres.reduce((s, i) => s + comptePersonnes(type, i), 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={titre} backHref="/dashboard" />

      <div className="px-4 py-4">
        <p className="mb-3 text-sm text-black/50">
          {filtres.length} invitation{filtres.length > 1 ? 's' : ''}
          {(type === 'arrives' || type === 'tous') && ' · ' + totalPersonnes + ' personne' + (totalPersonnes > 1 ? 's' : '') + ' arrivée' + (totalPersonnes > 1 ? 's' : '')}
        </p>

        {!loading && filtres.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="card py-2">
              <p className="text-xl font-bold">{totalParCote}</p>
              <p className="text-[11px] text-black/50">personnes</p>
            </div>
            <div className="card py-2">
              <p className="text-xl font-bold text-nelly">{parCote.Nelly}</p>
              <p className="text-[11px] text-black/50">côté Nelly</p>
            </div>
            <div className="card py-2">
              <p className="text-xl font-bold text-gege">{parCote.Gege}</p>
              <p className="text-[11px] text-black/50">côté Gégé</p>
            </div>
          </div>
        )}

        {loading && <p className="p-6 text-center text-black/50">Chargement…</p>}

        {!loading && filtres.length === 0 && (
          <p className="p-6 text-center text-black/50">Aucun résultat pour cette catégorie.</p>
        )}

        <ul className="divide-y divide-black/5">
          {filtres.map((inv) => {
            const prenoms = extractPrenoms(inv.notes);
            const table = inv.table_id ? tableParId.get(inv.table_id) : null;
            return (
              <li key={inv.id}>
                <button
                  className="flex w-full items-center justify-between gap-3 py-4 text-left"
                  onClick={() => router.push('/checkin/' + inv.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
                    {prenoms && <p className="truncate text-xs font-medium text-gold-700">{prenoms}</p>}
                    <p className="text-sm text-black/50">
                      {inv.nombre_arrive}/{inv.nombre_prevu} personnes
                      {table ? ' · Table ' + table.number : ''}
                    </p>
                  </div>
                  <StatusBadge statut={inv.statut} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
