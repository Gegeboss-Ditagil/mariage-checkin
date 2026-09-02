'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { createClient } from '@/lib/supabase/client';
import { CloseIcon } from '@/components/icons';

type Person = { id: string; nom_affichage: string; nom_complet: string | null; role: string; email: string | null };
type GuestOption = { id: string; nom_affichage: string };

// Enleve les accents/la casse pour comparer des noms de facon tolerante --
// meme recette que app/scan/page.tsx.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Fiche plein ecran (recherche + cases a cocher) pour choisir les
 * responsables d'une activite, a la place d'une longue liste toujours
 * depliee -- demande de Gersom le 02/09/2026 (capture d'ecran a l'appui) :
 * "au lieu d'avoir toute la liste des responsables a defiler... un champ...
 * quand je clique dessus ca me demande de choisir la personne et ca va me
 * montrer toutes les personnes qui ont l'etiquette staff (...) mais aussi
 * l'option de recherche au cas ou on assigne un invite lambda derniere
 * minute pour aider".
 *
 * Deux sources, memes deux champs qu'avant (seule la maniere de les
 * remplir change) :
 * - `people` (comptes de l'equipe, deja charges par le parent, l'"etiquette
 *   staff" -- affiches par defaut, sans recherche) -> assignee_ids.
 * - Invitations (chargees a la demande, uniquement une fois une recherche
 *   commencee, pour ne jamais charger ~400 lignes inutilement) -> nom ajoute
 *   a custom_assignees, exactement comme le nom libre deja existant.
 */
export function ResponsablePicker({
  people,
  selectedPersonIds,
  selectedCustomNames,
  onChange,
  onClose,
}: {
  people: Person[];
  selectedPersonIds: string[];
  selectedCustomNames: string[];
  onChange: (next: { assigneeIds: string[]; customNames: string[] }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGuests([]);
      return;
    }
    setLoadingGuests(true);
    let active = true;
    const timeout = setTimeout(() => {
      const supabase = createClient();
      supabase
        .from('invitations')
        .select('id, nom_affichage')
        .ilike('nom_affichage', '%' + q + '%')
        .order('nom_affichage')
        .limit(20)
        .then(({ data }) => {
          if (!active) return;
          setGuests((data as GuestOption[]) || []);
          setLoadingGuests(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const filteredPeople = useMemo(() => {
    const q = normalize(query);
    if (!q) return people;
    return people.filter((p) => normalize(p.nom_complet || p.nom_affichage).includes(q));
  }, [people, query]);

  function togglePerson(id: string) {
    const next = selectedPersonIds.includes(id)
      ? selectedPersonIds.filter((existing) => existing !== id)
      : [...selectedPersonIds, id];
    onChange({ assigneeIds: next, customNames: selectedCustomNames });
  }

  function toggleCustomName(name: string) {
    const next = selectedCustomNames.includes(name)
      ? selectedCustomNames.filter((existing) => existing !== name)
      : [...selectedCustomNames, name];
    onChange({ assigneeIds: selectedPersonIds, customNames: next });
  }

  function addCustomDraft() {
    const name = customDraft.trim();
    if (!name || selectedCustomNames.includes(name)) return;
    onChange({ assigneeIds: selectedPersonIds, customNames: [...selectedCustomNames, name] });
    setCustomDraft('');
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-bg/95 backdrop-blur-xl safe-top safe-bottom"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir les responsables"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="font-display text-lg">Responsables</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="glass-icon-button">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un nom…"
          className="input"
        />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Équipe</p>
          {filteredPeople.length === 0 ? (
            <p className="text-sm text-text-faint">Aucun résultat</p>
          ) : (
            <div className="space-y-2">
              {filteredPeople.map((person) => {
                const checked = selectedPersonIds.includes(person.id);
                return (
                  <button
                    type="button"
                    key={person.id}
                    onClick={() => togglePerson(person.id)}
                    className={clsx('action-row flex items-center gap-3 text-left', checked && 'border-accent bg-accent-tint')}
                  >
                    <span
                      aria-hidden
                      className={clsx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent text-xs font-bold transition-colors',
                        checked ? 'bg-accent text-on-accent' : 'text-transparent'
                      )}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 text-text">
                      <strong className="block truncate">{person.nom_complet || person.nom_affichage}</strong>
                      <small className="block text-text-muted">{person.role}{person.email ? ` · ${person.email}` : ''}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recherche parmi les invites -- "au cas ou on assigne un invite
            lambda derniere minute pour aider". Ne se charge qu'a partir de 2
            caracteres, jamais toute la liste des invites d'un coup. */}
        {query.trim().length >= 2 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Invités (aide de dernière minute)</p>
            {loadingGuests ? (
              <p className="text-sm text-text-faint">Recherche…</p>
            ) : guests.length === 0 ? (
              <p className="text-sm text-text-faint">Aucun invité trouvé pour « {query.trim()} »</p>
            ) : (
              <div className="space-y-2">
                {guests.map((guest) => {
                  const checked = selectedCustomNames.includes(guest.nom_affichage);
                  return (
                    <button
                      type="button"
                      key={guest.id}
                      onClick={() => toggleCustomName(guest.nom_affichage)}
                      className={clsx('action-row flex items-center gap-3 text-left', checked && 'border-accent bg-accent-tint')}
                    >
                      <span
                        aria-hidden
                        className={clsx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent text-xs font-bold transition-colors',
                          checked ? 'bg-accent text-on-accent' : 'text-transparent'
                        )}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-text">{guest.nom_affichage}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedCustomNames.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Noms ajoutés</p>
            <div className="space-y-2">
              {selectedCustomNames.map((name) => (
                <div key={name} className="action-row flex items-center justify-between gap-3 text-left">
                  <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
                  <button type="button" aria-label={'Retirer ' + name} onClick={() => toggleCustomName(name)} className="shrink-0 text-text-faint">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filet pour un nom absent de la liste des invites (ex. prestataire
            externe) -- meme mecanisme qu'avant, juste deplace ici. */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-faint">Ou un nom personnalisé</p>
          <div className="flex gap-2">
            <input
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addCustomDraft();
              }}
              placeholder="Ex. Nourdine, électricien"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={addCustomDraft}
              disabled={!customDraft.trim()}
              className="btn-secondary shrink-0 px-4 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline px-4 py-3">
        <button type="button" onClick={onClose} className="btn-primary w-full">Terminé</button>
      </div>
    </div>
  );
}
