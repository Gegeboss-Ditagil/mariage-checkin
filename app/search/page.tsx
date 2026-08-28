'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { COTE_DOT_COLORS, COTE_LABELS, InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { PHONE_COUNTRIES } from '@/lib/countries';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { extractPrenoms, extractMembresComplet } from '@/lib/membersNotes';

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
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const role = useSessionRole();
  const readOnly = !hasCapability(role, 'checkin');
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
  const [loadingAll, setLoadingAll] = useState(true);
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
    supabase
      .from('tables')
      .select('*')
      .order('number')
      .then(({ data }) => setAllTables((data as TableRow[]) || []));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('invitations')
      .select('*, table:tables(*)')
      .order('nom_affichage')
      .then(({ data }) => {
        setAllInvitations((data as Result[]) || []);
        setLoadingAll(false);
      });
  }, []);

  const tableResults = useMemo(() => {
    if (mode !== 'nom') return [];
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
      // 0 initial manquant, etc.).
      const digits = q.replace(/\D/g, '');
      const digitSuffix = digits.length >= 5 ? digits.slice(-8) : null;

      const orParts: string[] = [];
      if (mode === 'nom') {
        orParts.push(
          'nom_affichage.ilike.%' + q + '%',
          'groupe.ilike.%' + q + '%',
          'notes.ilike.%' + q + '%',
          'email.ilike.%' + q + '%'
        );
      }
      if (mode === 'email') {
        orParts.push('email.ilike.%' + q + '%');
      }
      if (digitSuffix && (mode === 'nom' || mode === 'telephone')) {
        orParts.push('telephone_digits.ilike.%' + digitSuffix + '%');
      }

      if (orParts.length === 0) {
        setResults([]);
        setLoading(false);
        return;
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
  }, [query, mode]);

  const hasQuery = query.trim().length >= (mode === 'telephone' ? 4 : 2);

  const browsing = mode === 'nom' && !hasQuery;
  const listeAffichee = browsing ? allInvitations : results;

  function InvitationItem({ r }: { r: Result }) {
    const prenoms = extractPrenoms(r.notes);
    const membres = extractMembresComplet(r.notes);
    const expanded = expandedId === r.id;

    return (
      <li>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-4 text-left"
          onClick={() => setExpandedId(expanded ? null : r.id)}
        >
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{r.nom_affichage}</p>
            {prenoms && <p className="truncate text-xs font-medium text-gold-600">{prenoms}</p>}
            <p className="text-sm text-black/50">
              {r.table ? 'Table ' + r.table.number : 'Sans table'} · {r.nombre_prevu} personne
              {r.nombre_prevu > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge statut={r.statut} />
            <span className={'text-lg text-black/30 transition-transform' + (expanded ? ' rotate-180' : '')}>⌄</span>
          </div>
        </button>

        {expanded && (
          <div className="mb-4 rounded-xl2 bg-white p-3 text-sm shadow-card">
            {r.cote && (
              <span className="mb-2 mr-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold">
                <span className={'h-2 w-2 rounded-full ' + COTE_DOT_COLORS[r.cote]} />
                {COTE_LABELS[r.cote]}
              </span>
            )}
            {(r.tags || []).map((tag) => (
              <span
                key={tag}
                className="mb-2 mr-1.5 inline-block rounded-full bg-gold-400/10 px-2.5 py-1 text-xs font-semibold text-gold-700"
              >
                {tag}
              </span>
            ))}
            {!r.cote && (!r.tags || r.tags.length === 0) && (
              <p className="mb-2 text-xs italic text-black/40">Aucun tag enregistré</p>
            )}

            {membres.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {membres.map((membre, index) => (
                  <li key={index} className="text-black/70">{membre}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-black/40">
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
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Rechercher un invité" backHref={readOnly ? '/dashboard' : '/scan'} />

      <div className="px-4 pt-3">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('nom')}
            className={
              'flex-1 rounded-xl2 border-2 py-2 text-xs font-semibold uppercase tracking-wide ' +
              (mode === 'nom' ? 'border-gold-500 bg-gold-400/10 ' : 'border-gold-300/30 bg-white text-black/60')
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
                ? 'border-gold-500 bg-gold-400/10 '
                : 'border-gold-300/30 bg-white text-black/60')
            }
          >
            Téléphone
          </button>
          <button
            type="button"
            onClick={() => setMode('email')}
            className={
              'flex-1 rounded-xl2 border-2 py-2 text-xs font-semibold uppercase tracking-wide ' +
              (mode === 'email' ? 'border-gold-500 bg-gold-400/10 ' : 'border-gold-300/30 bg-white text-black/60')
            }
          >
            Email
          </button>
        </div>

        {mode === 'nom' && (
          <input
            autoFocus
            className="w-full rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3.5 text-lg  placeholder:text-black/30 focus:border-gold-500 focus:outline-none"
            placeholder="Prénom, nom, table, téléphone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}

        {mode === 'telephone' && (
          <div className="space-y-2">
            <select
              className="w-full rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3  focus:border-gold-500 focus:outline-none"
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
              <span className="shrink-0 rounded-xl2 border-2 border-gold-300/40 bg-white px-3 py-3.5 text-lg text-black/60">
                {country.indicatif}
              </span>
              <input
                autoFocus
                inputMode="tel"
                className="min-w-0 flex-1 rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3.5 text-lg  placeholder:text-black/30 focus:border-gold-500 focus:outline-none"
                placeholder={'ex : ' + country.exemple}
                value={phoneNational}
                onChange={(e) => setPhoneNational(e.target.value)}
              />
            </div>
            <p className="text-xs text-black/40">
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
            className="w-full rounded-xl2 border-2 border-gold-300/40 bg-white px-4 py-3.5 text-lg  placeholder:text-black/30 focus:border-gold-500 focus:outline-none"
            placeholder="prenom.nom@exemple.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
        )}
      </div>

      {loading && <p className="p-4 text-center text-black/40">Recherche…</p>}
      {browsing && loadingAll && <p className="p-4 text-center text-black/40">Chargement…</p>}

      {!loading && hasQuery && tableResults.length === 0 && results.length === 0 && (
        <p className="p-6 text-center text-black/50">Aucun résultat pour « {query} »</p>
      )}

      {tableResults.length > 0 && (
        <div className="px-4 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">Tables</p>
          <div className="space-y-2">
            {tableResults.map((t) => {
              const vol = volCode(t.number);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center justify-between rounded-xl2 border-2 border-gold-300/30 bg-white px-4 py-3 text-left"
                  onClick={() => router.push('/tables/' + t.id)}
                >
                  <span>
                    <span className="block font-semibold ">
                      Table {t.number}
                      {t.label ? ' — ' + t.label : ''}
                    </span>
                    {vol && <span className="block text-xs text-black/40">{vol}</span>}
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
            <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-black/40">Invités</p>
          )}
          {browsing && (
            <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-black/40">
              Toutes les invitations ({listeAffichee.length}) — appuyez pour voir qui est dedans et ses tags
            </p>
          )}
          <ul className="flex-1 divide-y divide-gold-400/10 pb-6">
            {listeAffichee.map((r) => <InvitationItem key={r.id} r={r} />)}
          </ul>
        </div>
      )}
    </div>
  );
}



