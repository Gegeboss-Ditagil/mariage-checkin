'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { restants } from '@/lib/statusLogic';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';

// Une invitation est "staff" si elle porte la categorie Staff, quelle que
// soit sa table (certains membres du staff ont une table, d'autres non --
// voir isNoTable ci-dessous). C'est la meme convention deja utilisee sur
// l'ecran "Rechercher un invite" pour le badge Staff.
function isStaff(inv: InvitationRow): boolean {
  return inv.category === 'Staff';
}

// "notable" est le tag pose manuellement par Gersom dans With Joy sur les
// personnes du staff qui n'ont volontairement PAS de table assignee (ex:
// photographe, MC, DJ) -- elles seront accueillies directement via un QR
// "STAFF" plutot que via une table. Compare sans accents/tirets/espaces
// pour tolerer "notable", "no_table", "no-table", "Sans table", etc.
function normalizeTag(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function isNoTable(inv: InvitationRow): boolean {
  return (inv.tags || []).some((t) => normalizeTag(t) === 'notable');
}

interface StaffInvitation extends InvitationRow {
  table?: TableRow | null;
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

export default function StaffPage() {
  const router = useRouter();
  const role = useSessionRole();
  // Comme sur /table/[tableId] : tout le monde qui peut voir cet ecran voit
  // la liste complete, seuls ceux qui ont la capacite "checkin" peuvent
  // toucher une ligne pour cocher une arrivee.
  const canCheckin = hasCapability(role, 'checkin');
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('invitations')
        .select('*, table:tables(*)')
        .eq('category', 'Staff')
        .order('nom_affichage');
      if (!active) return;
      setInvitations((data as StaffInvitation[]) || []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const staff = invitations.filter(isStaff);
  const prevu = staff.reduce((s, i) => s + i.nombre_prevu, 0);
  const arrive = staff.reduce((s, i) => s + i.nombre_arrive, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Staff"
        backHref={role && hasCapability(role, 'scan') ? '/scan' : '/dashboard'}
      />

      {loading && <p className="p-4 text-center text-black/50">Chargement…</p>}

      {!loading && (
        <div className="px-4 pt-3">
          <div className="card mb-2 grid grid-cols-3 text-center">
            <div>
              <p className="text-xs uppercase text-black/40">Prévu</p>
              <p className="text-2xl font-bold">{prevu}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-black/40">Arrivés</p>
              <p className="text-2xl font-bold text-status-complete">{arrive}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-black/40">Restants</p>
              <p className="text-2xl font-bold text-status-partial">{Math.max(0, prevu - arrive)}</p>
            </div>
          </div>
          <p className="mb-2 text-xs text-black/40">
            Toute personne du staff (photographe, MC, DJ, service, sécurité…), qu'elle ait une table ou non — voir le
            badge « Sans table » pour celles accueillies directement ici, sans table assignée.
          </p>
        </div>
      )}

      {!loading && staff.length === 0 && (
        <p className="p-6 text-center text-black/50">Aucun membre du staff enregistré pour l'instant.</p>
      )}

      <ul className="flex-1 divide-y divide-gold-400/10 px-4">
        {staff.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          const sansTable = isNoTable(inv);
          const body = (
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
              {prenoms && <p className="truncate text-xs font-medium text-gold-600">{prenoms}</p>}
              <p className="text-sm text-black/50">
                {inv.telephone || 'Pas de numéro enregistré'}
              </p>
              <p className="text-sm text-black/50">
                {inv.table ? 'Table ' + inv.table.number + (inv.table.label ? ' — ' + inv.table.label : '') : 'Sans table'}
              </p>
              <p className="text-sm text-black/50">
                {inv.nombre_arrive}/{inv.nombre_prevu} personnes
                {inv.statut === 'partiel' && ' · ' + restants(inv.nombre_prevu, inv.nombre_arrive) + ' restantes'}
              </p>
              {sansTable && (
                <span className="mt-1 inline-block rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">
                  Sans table
                </span>
              )}
            </div>
          );
          return (
            <li key={inv.id} className="flex items-center gap-1">
              {canCheckin ? (
                <button
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 py-4 text-left"
                  onClick={() => router.push('/checkin/' + inv.id)}
                >
                  {body}
                  <StatusBadge statut={inv.statut} />
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-4">
                  {body}
                  <StatusBadge statut={inv.statut} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {role && <BottomNav role={role} />}
    </div>
  );
}
