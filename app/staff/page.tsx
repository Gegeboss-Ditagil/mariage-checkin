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
import { isStaffWithoutTable } from '@/lib/staffVisibility';

// Une invitation est "staff" si elle porte la categorie Staff, quelle que
// soit sa table (certains membres du staff ont une table, d'autres non --
// voir isNoTable ci-dessous). C'est la meme convention deja utilisee sur
// l'ecran "Rechercher un invite" pour le badge Staff.
function isStaff(inv: InvitationRow): boolean {
  return inv.category === 'Staff';
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
  // Tous les roles autorises voient cet ecran, mais seuls ceux qui ont la
  // capacite "checkin" peuvent toucher une ligne pour cocher une arrivee.
  const canCheckin = hasCapability(role, 'checkin');
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const response = await fetch('/api/staff', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!active) return;
      setInvitations(response.ok ? ((payload?.invitations as StaffInvitation[]) || []) : []);
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

  // La restriction des lignes est deja appliquee par /api/staff apres
  // verification de la session signee. Cette condition ne sert qu'au texte
  // d'interface; elle n'est jamais utilisee comme controle d'autorisation.
  const seesOnlyNoTable = !!role && !hasCapability(role, 'viewAllStaff');
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
            {seesOnlyNoTable
              ? 'Personnel sans table assignée (photographe, MC, DJ…), accueilli directement via le QR « STAFF ».'
              : "Toute personne du staff (photographe, MC, DJ, service, sécurité…), qu'elle ait une table ou non — voir le badge « Sans table » pour celles accueillies directement ici, sans table assignée."}
          </p>
        </div>
      )}

      {!loading && staff.length === 0 && (
        <p className="p-6 text-center text-black/50">
          {seesOnlyNoTable
            ? "Aucune personne du staff sans table pour l'instant."
            : "Aucun membre du staff enregistré pour l'instant."}
        </p>
      )}

      <ul className="flex-1 divide-y divide-gold-400/10 px-4">
        {staff.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          const sansTable = isStaffWithoutTable(inv);
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
