'use client';

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTransitionRouter as useRouter } from 'next-view-transitions';
import { createClient } from '@/lib/supabase/client';
import { COTE_DOT_COLORS, COTE_LABELS, InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { PHONE_COUNTRIES } from '@/lib/countries';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { extractPrenoms, extractMembresComplet } from '@/lib/membersNotes';
import { GuestContactButton } from '@/components/GuestContactButton';
import { buildInvitationSearchFilters, tableSearchText } from '@/lib/searchFilters';

interface Result extends InvitationRow {
  table?: TableRow | null;
}

type Mode = 'nom' | 'telephone' | 'email';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-bg" />}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const role = useSessionRole();
  const readOnly = !hasCapability(role, 'checkin');
  // contactGuests : admin/directeur uniquement -- appeler/texter un INVITE
  // directement depuis cette page (retour de Gersom le 07/10/2026), distinct
  // de callStaff/messageContacts qui portent sur le STAFF (/staff).
  const canContactGuests = hasCapability(role, 'contactGuests');
  const params = useSearchParams();
  const modeParam = params.get('mode');
  const initialMode: Mode = modeParam === 'telephone' || modeParam === 'email' ? modeParam : 'nom';

  const [mode, setMode] = useState<Mode>(initialMode);
  // "query" reste la SEULE source de verite pour la recherche : que ce soit
  // le mode nom/table (saisie libre), telephone (assemble a partir du pays +
  // numero national) ou email, tout finit par alimenter ce meme texte, pour
  // reutiliser telle quelle la logique de recherche existante (qui compare
  // deja nom, groupe, email ET telephone_digits en une seule requete).
  const [query, setQuery] = useState('');
  const [countryCode, setCountryCode] = useState(PHONE_COUNTRIES[0].code);
  const [phoneNational, setPhoneNational] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [allTables, setAllTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [allInvitations, setAllInvitations] = useState<Result[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const country = PHONE_COUNTRIES.find((c) => c.code === countryCode) || PHONE_COUNTRIES[0];

  // Assemble l'indicatif pays + le numero national saisi en une chaine de
  // chiffres, en retirant un eventuel zero initial (convention locale : "06
  // 12 34 56 78" devient "6 12 34 56 78" une fois l'indicatif ajoute devant,
  // exactement comme WithJoy le demande a l'import).
  useEffect(() => {
    if (mode !== 'telephone') return;
    const nationalDigits = phoneNational.replace(/\D/g, '').replace(/^0+/, '');
    setQuery(nationalDigits ? country.indicatif + nationalDigits : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phoneNational, countryCode]);

  useEffect(() => {
    if (mode !== 'email') return;
    setQuery(emailInput.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, emailInput]);

  useEffect(() => {
    const supabase = createClient();
    // Chargement differe volontairement : le "parcourir toutes les
    // invitations" ne declenche le fetch du dataset complet QUE lorsque
    // l'agent est reellement en mode parcours (nom sans saisie), au lieu de
    // telecharger tout l'evenement a l'ouverture de /search. Colonnes
    // limitees a ce que la liste affiche.
    supabase
      .from('tables')
      .select('*')
      .gt('capacity', 0)
      .order('number')
      .then(({ data }) => setAllTables((data as TableRow[]) || []));
  }, []);

  const tableResults = useMemo(() => {
    if (mode !== 'nom') return [];
    const q = tableSearchText(query);
    if (q.length < 1 || query.trim().length < 2) return [];
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
  }, [allTables, query, mode]);

  useEffect(() => {
    const q = query.trim();
    const seuil = mode === 'telephone' ? 4 : 2;
    if (q.length < seuil) {
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
      // 0 initial manquant, etc.). v1.73.0 : chaque mot doit etre present,
      // dans n'importe quel ordre (lib/searchFilters.ts).
      const filters = buildInvitationSearchFilters(mode, q);
      if (filters.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      let request = supabase.from('invitations').select('*, table:tables(*)');
      for (const group of filters) request = request.or(group);
      const { data } = await request.limit(25);

      setResults((data as Result[]) || []);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, mode]);

  // v1.70.0 : la bascule « toutes les invitations » <-> « résultats » est
  // pilotée par une valeur DIFFÉRÉE de la saisie. Sans ça, la 2e lettre
  // tapée démontait synchroniquement les ~250 lignes de la liste dans le
  // même événement clavier (INP mesuré à 1,1 s sur la preview : le champ
  // gelait). La saisie reste instantanée, la liste suit juste après.
  const deferredQuery = useDeferredValue(query);
  const hasQuery = deferredQuery.trim().length >= (mode === 'telephone' ? 4 : 2);

  const browsing = mode === 'nom' && !hasQuery;
  const listeAffichee = browsing ? allInvitations : results;

  // Parcours complet : charge le dataset (colonnes reduites) seulement quand
  // l'ecran bascule en mode "parcourir toutes les invitations" -- plus aucun
  // fetch du jour J complet au simple montage de /search.
  useEffect(() => {
    if (!browsing) return;
    let active = true;
    setLoadingAll(true);
    const supabase = createClient();
    supabase
      .from('invitations')
      .select('id, nom_affichage, groupe, category, tags, notes, statut, nombre_prevu, nombre_arrive, cote, telephone, table:tables(id, number, label)')
      .order('nom_affichage')
      .then(({ data }) => {
        if (!active) return;
        // Lignes reduites (voir select ci-dessus) : InvitationItem n'utilise
        // que ces colonnes, le cast via unknown documente l'ecart volontaire
        // avec le type complet Result.
        setAllInvitations((data as unknown as Result[]) || []);
        setLoadingAll(false);
      });
    return () => {
      active = false;
    };
  }, [browsing]);

  function InvitationItem({ r }: { r: Result }) {
    const prenoms = extractPrenoms(r.notes);
    const membres = extractMembresComplet(r.notes);
    const expanded = expandedId === r.id;

    return (
      <li>
        <div className="flex items-center gap-1 py-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
            onClick={() => setExpandedId(expanded ? null : r.id)}
          >
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{r.nom_affichage}</p>
              {prenoms && <p className="truncate text-xs font-medium text-accent">{prenoms}</p>}
              <p className="text-sm text-text-faint">
                {r.table ? 'Table ' + r.table.number : 'Sans table'} · {r.nombre_prevu} personne
                {r.nombre_prevu > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge statut={r.statut} />
              <span className={'text-lg text-text-faint transition-transform' + (expanded ? ' rotate-180' : '')}>⌄</span>
            </div>
          </button>
          {/* Bouton contact SIBLING du bouton de la ligne (pas imbrique dedans
              -- un <button>/<a> a l'interieur d'un <button> est invalide en
              HTML, meme pattern que CallButton/MessageButton sur /staff) --
              empeche sa propre propagation pour ne pas ouvrir/fermer la fiche
              au passage. Reserve admin/directeur (capacite contactGuests). */}
          {canContactGuests && r.telephone && <GuestContactButton telephone={r.telephone} name={r.nom_affichage} />}
        </div>

        {expanded && (
          <div className="mb-4 rounded-xl2 bg-surface p-3 text-sm shadow-card">
            {r.cote && (
              <span className="mb-2 mr-1.5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                <span className={'h-2 w-2 rounded-full ' + COTE_DOT_COLORS[r.cote]} />
                {COTE_LABELS[r.cote]}
              </span>
            )}
            {(r.tags || []).map((tag) => (
              <span
                key={tag}
                className="mb-2 mr-1.5 inline-block rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {tag}
              </span>
            ))}
            {!r.cote && (!r.tags || r.tags.length === 0) && (
              <p className="mb-2 text-xs italic text-text-faint">Aucun tag enregistré</p>
            )}

            {membres.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {membres.map((membre, index) => (
                  <li key={index} className="text-text-muted">{membre}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-text-faint">
                Détail des personnes non disponible pour ce groupe (seul le nom affiché "{r.nom_affichage}" est connu).
              </p>
            )}

            {!readOnly && (
              <button
                type="button"
                className="btn-secondary mt-3 w-full text-center text-sm"
                onClick={() => router.push('/checkin/' + r.id)}
              >
                Ouvrir le check-in
              </button>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 flex h-[100svh] flex-col overflow-hidden bg-bg landscape:flex-row landscape:h-[calc(100svh-env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Rechercher un invité" backHref={readOnly ? '/dashboard' : '/scan'} />

        <div className="px-4 pt-3">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode('nom')}
              className={
                'flex-1 rounded-xl2 border-2 py-2 text-xs font-semibold uppercase tracking-wide ' +
                (mode === 'nom' ? 'border-accent bg-accent text-on-accent ' : 'border-hairline bg-surface text-text-muted')
              }
            >
              Nom / table
            </button>
            <button
              type="button"
              onClick={() => setMode('telephone')}
              className={
                'flex-1 rounded-xl2 border-2 py-2 text-xs font-semibold uppercase tracking-wide ' +
                (mode === 'telephone'
                  ? 'border-accent bg-accent text-on-accent '
                  : 'border-hairline bg-surface text-text-muted')
              }
            >
              Téléphone
            </button>
            <button
              type="button"
              onClick={() => setMode('email')}
              className={
                'flex-1 rounded-xl2 border-2 py-2 text-xs font-semibold uppercase tracking-wide ' +
                (mode === 'email' ? 'border-accent bg-accent text-on-accent ' : 'border-hairline bg-surface text-text-muted')
              }
            >
              Email
            </button>
          </div>

          {mode === 'nom' && (
            <input
              autoFocus
              className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3.5 text-lg  placeholder:text-text-faint focus:border-accent focus:outline-none"
              placeholder="Prénom, nom, table, téléphone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          {mode === 'telephone' && (
            <div className="space-y-2">
              <select
                className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3  focus:border-accent focus:outline-none"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.nom} ({c.indicatif})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-xl2 border-2 border-hairline bg-surface px-3 py-3.5 text-lg text-text-muted">
                  {country.indicatif}
                </span>
                <input
                  autoFocus
                  inputMode="tel"
                  className="min-w-0 flex-1 rounded-xl2 border-2 border-hairline bg-surface px-4 py-3.5 text-lg  placeholder:text-text-faint focus:border-accent focus:outline-none"
                  placeholder={'ex : ' + country.exemple}
                  value={phoneNational}
                  onChange={(e) => setPhoneNational(e.target.value)}
                />
              </div>
              <p className="text-xs text-text-faint">
                Choisissez le pays puis saisissez le numéro sans le 0 initial — exemple pour {country.nom} :{' '}
                {country.indicatif} {country.exemple}
              </p>
            </div>
          )}

          {mode === 'email' && (
            <input
              autoFocus
              type="email"
              autoCapitalize="none"
              className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3.5 text-lg  placeholder:text-text-faint focus:border-accent focus:outline-none"
              placeholder="prenom.nom@exemple.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
        {loading && <p className="p-4 text-center text-text-faint">Recherche…</p>}
        {browsing && loadingAll && <p className="p-4 text-center text-text-faint">Chargement…</p>}

        {!loading && hasQuery && tableResults.length === 0 && results.length === 0 && (
          <p className="p-6 text-center text-text-faint">Aucun résultat pour « {query} »</p>
        )}

        {tableResults.length > 0 && (
          <div className="px-4 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Tables</p>
            <div className="space-y-2">
              {tableResults.map((t) => {
                const vol = volCode(t.number);
                return (
                  <button
                    key={t.id}
                    className="flex w-full items-center justify-between rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-left"
                    onClick={() => router.push('/tables/' + t.id)}
                  >
                    <span>
                      <span className="block font-semibold ">
                        Table {t.number}
                        {t.label ? ' — ' + t.label : ''}
                      </span>
                      {vol && <span className="block text-xs text-text-faint">{vol}</span>}
                    </span>
                    {t.is_reserve && <span className="text-xs text-status-partial">Réserve</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {listeAffichee.length > 0 && (
          <div className="mt-2 px-4">
            {tableResults.length > 0 && (
              <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-text-faint">Invités</p>
            )}
            {browsing && (
              <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-text-faint">
                Toutes les invitations ({listeAffichee.length}) — appuyez pour voir qui est dedans et ses tags
              </p>
            )}
            <ul className="divide-y divide-hairline pb-6">
              {listeAffichee.map((r) => <InvitationItem key={r.id} r={r} />)}
            </ul>
          </div>
        )}
        </div>

      </div>
      {role && <BottomNav role={role} />}
    </div>
  );
}



