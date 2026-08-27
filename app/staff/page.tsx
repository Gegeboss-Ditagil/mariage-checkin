'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { restants } from '@/lib/statusLogic';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { isStaffWithoutTable } from '@/lib/staffVisibility';
import { MessageButton } from '@/components/MessageButton';

// Une invitation est "staff" si elle porte la categorie Staff.
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
  // Comme sur /table/[tableId] : tout le monde qui peut voir cet ecran voit
  // la liste, seuls ceux qui ont la capacite "checkin" peuvent toucher une
  // ligne pour cocher une arrivee.
  const canCheckin = hasCapability(role, 'checkin');
  const canSeeAllStaff = hasCapability(role, 'viewAllStaff');
  // Bouton d'appel direct reserve admin/directeur -- demande explicite de
  // Gersom le 23/08/2026 : les autres roles n'ont pas besoin d'appeler.
  const canCall = hasCapability(role, 'callStaff');
  const canMessage = hasCapability(role, 'messageContacts');
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tableFilter, setTableFilter] = useState<'sans' | 'avec'>('sans');

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch('/api/staff', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!active) return;
      setInvitations(response.ok ? ((payload?.invitations as StaffInvitation[]) || []) : []);
      setLoading(false);
    }

    load();
    // La session de l'application n'est pas une session Supabase Auth : une
    // souscription Realtime ouverte depuis le navigateur utiliserait donc le
    // role anon et recevrait potentiellement le payload complet avant le
    // filtrage applicatif. On rafraichit exclusivement via l'API protegee.
    const refreshInterval = window.setInterval(load, 10_000);
    const refreshOnFocus = () => load();
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  // /staff n'affiche que le personnel SANS table (tag "notable" -- photographe,
  // DJ, MC, prestataires...), pour tous les roles -- precise par Gersom le
  // 23/08/2026. Le reste du staff (avec table) est deja compte comme
  // invite normal, arrive avec sa famille/son groupe, et n'a pas le badge QR
  // "STAFF" (le sien est un QR de table classique) : il n'a donc pas sa
  // place ici, uniquement les personnes qu'un agent doit controler et laisser
  // entrer rapidement sans les rattacher a une table.
  const staffAll = useMemo(() => invitations.filter(isStaff), [invitations]);
  const staffSansTable = useMemo(() => staffAll.filter(isStaffWithoutTable), [staffAll]);
  const staffAvecTable = useMemo(() => staffAll.filter((inv) => !isStaffWithoutTable(inv)), [staffAll]);
  const activeStaff = canSeeAllStaff && tableFilter === 'avec' ? staffAvecTable : staffSansTable;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeStaff;
    const phoneQuery = q.replace(/\D/g, '');
    return activeStaff.filter((inv) => {
      const prenoms = (extractPrenoms(inv.notes) || '').toLowerCase();
      return (
        inv.nom_affichage.toLowerCase().includes(q) ||
        prenoms.includes(q) ||
        (phoneQuery.length > 0 && (inv.telephone || '').replace(/\D/g, '').includes(phoneQuery))
      );
    });
  }, [activeStaff, query]);

  const prevu = activeStaff.reduce((s, i) => s + i.nombre_prevu, 0);
  const arrive = activeStaff.reduce((s, i) => s + i.nombre_arrive, 0);

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
          <p className="mb-3 text-xs text-black/40">
            {tableFilter === 'sans' || !canSeeAllStaff
              ? 'Personnel et prestataires sans table assignée (photographe, MC, DJ…), accueillis directement via le QR « STAFF » — le reste du staff a une table et se check-in normalement avec son groupe.'
              : 'Personnel avec une table assignée : se présente et se check-in normalement avec son groupe, comme un invité.'}
          </p>
          {canSeeAllStaff && (
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setTableFilter('sans')}
                className={
                  'flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ' +
                  (tableFilter === 'sans' ? 'bg-gold-500 text-white' : 'bg-gold-100 text-gold-700')
                }
              >
                Sans table ({staffSansTable.length})
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('avec')}
                className={
                  'flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ' +
                  (tableFilter === 'avec' ? 'bg-gold-500 text-white' : 'bg-gold-100 text-gold-700')
                }
              >
                Avec table ({staffAvecTable.length})
              </button>
            </div>
          )}
          <input
            className="mb-2 w-full rounded-xl2 border-2 border-gold-300/30 bg-white px-4 py-3 text-base placeholder:text-black/30 focus:border-gold-500 focus:outline-none"
            placeholder="Rechercher un nom du staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="p-6 text-center text-black/50">
          {activeStaff.length === 0
            ? tableFilter === 'sans' || !canSeeAllStaff
              ? "Aucune personne du staff sans table pour l'instant."
              : "Aucune personne du staff avec table pour l'instant."
            : 'Aucun résultat pour cette recherche.'}
        </p>
      )}

      <ul className="flex-1 divide-y divide-gold-400/10 px-4">
        {filtered.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          const sansTable = isStaffWithoutTable(inv);
          const body = (
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
              {prenoms && <p className="truncate text-xs font-medium text-gold-600">{prenoms}</p>}
              {!sansTable && (
                <p className="text-sm text-black/50">
                  {inv.table ? 'Table ' + inv.table.number + (inv.table.label ? ' — ' + inv.table.label : '') : 'Sans table'}
                </p>
              )}
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
            <li key={inv.id} className="flex items-center gap-1 py-4">
              {canCheckin ? (
                <button
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  onClick={() => router.push('/checkin/' + inv.id)}
                >
                  {body}
                  <StatusBadge statut={inv.statut} />
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  {body}
                  <StatusBadge statut={inv.statut} />
                </div>
              )}
              {/* Appel direct : tel: ouvre le composeur du telephone sans
                  passer par le check-in -- utile pour joindre un
                  photographe/DJ/MC en retard sans devoir d'abord toucher la
                  ligne. Empeche la propagation pour ne pas declencher le
                  clic sur toute la ligne (qui ouvrirait le check-in).
                  Reserve admin/directeur (capacite callStaff). */}
              {canCall && inv.telephone && (
                <a
                  href={'tel:' + inv.telephone}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={'Appeler ' + inv.nom_affichage}
                  className="shrink-0 rounded-full bg-gold-100 p-2.5 text-gold-700"
                >
                  📞
                </a>
              )}
              {canMessage && inv.telephone && <MessageButton telephone={inv.telephone} name={inv.nom_affichage} />}
            </li>
          );
        })}
      </ul>

      {role && <BottomNav role={role} />}
    </div>
  );
}
