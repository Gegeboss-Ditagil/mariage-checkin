'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BottomNav } from '@/components/BottomNav';
import { TopBar } from '@/components/TopBar';
import { CloseIcon, ChevronRightIcon } from '@/components/icons';
import { ResponsablePicker } from '@/components/ResponsablePicker';
import { useSessionRole } from '@/hooks/useSessionRole';

type Person = { id: string; nom_affichage: string; nom_complet: string | null; role: string; email: string | null };
type AgendaItem = { id: string; time_label: string; title: string; department: string; details: string | null; sort_order: number; assignee_ids: string[]; custom_assignees: string[]; completed: boolean };

// `time_label` accepte une heure seule ("08:00") ou une plage ("18:30–19:00",
// tiret cadratin -- voir le chronogramme seed dans 0039_shared_agenda.sql).
// Separe les deux roues natives <input type="time"> (l'equivalent web du
// roulement iPhone demande par Gersom) de la chaine stockee en base.
function parseTimeLabel(label: string): { start: string; end: string } {
  const [start, end] = label.split(/[–-]/).map((s) => s.trim());
  return { start: start || '', end: end || '' };
}

function composeTimeLabel(start: string, end: string): string {
  return end ? start + '–' + end : start;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">{children}</label>;
}

/**
 * Heure : deux roues natives iOS/Android (<input type="time">) plutot qu'un
 * champ texte libre -- demande explicite de Gersom le 02/09/2026 ("met le
 * roll comme iPhone pour choisir"). Une case a cocher revele la seconde
 * roue pour saisir une plage ; la valeur composee vit dans un champ cache
 * `time_label` pour que addItem/patchItem (FormData) n'aient rien a changer.
 */
function TimeRangePicker({ initialLabel }: { initialLabel: string }) {
  const initial = useMemo(() => parseTimeLabel(initialLabel), [initialLabel]);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [isRange, setIsRange] = useState(!!initial.end);

  return (
    <div>
      <FieldLabel>Heure</FieldLabel>
      <input type="hidden" name="time_label" value={composeTimeLabel(start, isRange ? end : '')} />
      <div className="flex items-center gap-2">
        <input
          type="time"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="input flex-1 tabular-nums"
        />
        {isRange && (
          <>
            <span aria-hidden className="text-text-faint">–</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="input flex-1 tabular-nums"
            />
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsRange((v) => !v)}
        className="mt-1.5 text-xs font-semibold text-accent"
      >
        {isRange ? '− Retirer l’heure de fin' : '+ Ajouter une heure de fin (plage horaire)'}
      </button>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg">{title}</h2>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-surface/75 text-text shadow-sm backdrop-blur-xl transition-transform active:scale-90"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function AgendaPage() {
  const role = useSessionRole();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgendaItem | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(false);
  // Fiche plein ecran de recherche des responsables -- demande de Gersom le
  // 02/09/2026 : "au lieu d'avoir toute la liste des responsables a
  // defiler... un champ" (voir components/ResponsablePicker.tsx). Fermee a
  // chaque ouverture/fermeture de la fiche d'activite pour ne pas rester
  // ouverte d'une activite a l'autre (state du parent, elle se
  // demonte/remonte mais pas la page).
  const [responsablePickerOpen, setResponsablePickerOpen] = useState(false);

  function openEditing(item: AgendaItem | null) {
    setResponsablePickerOpen(false);
    setEditing(item);
  }

  const load = useCallback(async () => {
    const response = await fetch('/api/agenda', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) {
      setError("L’agenda partagé n’est pas encore installé en base. Appliquez la migration 0039.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    setItems(data.items || []);
    setPeople(data.people || []);
    setCanManage(data.canManage === true);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  async function patchItem(id: string, updates: Record<string, unknown>) {
    const response = await fetch('/api/agenda', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Modification impossible');
      return false;
    }
    setItems((current) => current.map((item) => item.id === id ? data.item : item).sort((a, b) => a.sort_order - b.sort_order));
    setError(null);
    return true;
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      time_label: form.get('time_label'), title: form.get('title'), department: form.get('department'), details: form.get('details'), sort_order: insertAt,
    }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Ajout impossible');
    setItems((current) => [...current, data.item].sort((a, b) => a.sort_order - b.sort_order));
    setInsertAt(null);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Agenda du jour J" backHref="/dashboard" />
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="card mb-4 space-y-2">
            <p className="eyebrow">Samedi 24 octobre 2026</p>
            <h1 className="font-display text-xl">Chronogramme partagé</h1>
            <p className="text-sm text-text-muted">Les changements et affectations apparaissent pour toute l’équipe. Gersom, Nelly, les administrateurs et directeurs de festin peuvent les modifier.</p>
          </div>
          {error && <p className="mb-3 rounded-xl2 bg-status-over/10 p-3 text-sm text-status-over">{error}</p>}
          {loading ? <p className="py-10 text-center text-text-muted">Chargement de l’agenda…</p> : (
            <ol className="space-y-2" aria-label="Chronogramme du mariage">
              {items.map((item, index) => {
                const assignees = item.assignee_ids.map((id) => peopleById.get(id)).filter(Boolean) as Person[];
                // Noms de compte + noms libres (ex: prestataires sans compte
                // dans l'appli) affiches ensemble, sans les distinguer visuellement.
                const assigneeNames = [
                  ...assignees.map((person) => person.nom_complet || person.nom_affichage),
                  // Filet cote client : l'API normalise deja custom_assignees en
                  // tableau (voir app/api/agenda/route.ts), mais un item deja en
                  // memoire avant un rechargement ne doit jamais faire planter le
                  // rendu si ce champ manquait encore.
                  ...(item.custom_assignees || []),
                ];
                return <li key={item.id}>
                  {canManage && <button type="button" className="mx-auto mb-2 block rounded-full border border-dashed border-accent/50 px-3 py-1 text-xs font-semibold text-accent" onClick={() => setInsertAt(index === 0 ? item.sort_order - 5 : (items[index - 1].sort_order + item.sort_order) / 2)}>+ Ajouter une activité ici</button>}
                  <article
                    className={clsx('card flex gap-3 py-3', canManage && 'cursor-pointer transition-transform active:scale-[0.99]')}
                    onClick={() => canManage && openEditing(item)}
                    role={canManage ? 'button' : undefined}
                    tabIndex={canManage ? 0 : undefined}
                    aria-label={canManage ? 'Modifier ' + item.title : undefined}
                    onKeyDown={canManage ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditing(item); } } : undefined}
                  >
                    {/* Case a part (pas dans la zone cliquable de la carte) : appuyer dessus coche/decoche sans ouvrir la modification. */}
                    {canManage && (
                      <button
                        type="button"
                        aria-label={item.completed ? 'Marquer à faire' : 'Marquer terminé'}
                        onClick={(e) => { e.stopPropagation(); void patchItem(item.id, { completed: !item.completed }); }}
                        className="mt-0.5 h-7 w-7 shrink-0 rounded-full border-2 border-accent text-sm font-bold text-accent"
                      >
                        {item.completed ? '✓' : ''}
                      </button>
                    )}
                    <time className="w-16 shrink-0 pt-1 text-sm font-bold tabular-nums text-accent">{item.time_label}</time>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-start justify-between gap-2"><p className={item.completed ? 'font-semibold line-through opacity-60' : 'font-semibold'}>{item.title}</p><span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{item.department}</span></div>
                      {item.details && <p className="mt-1 text-xs leading-relaxed text-text-muted">{item.details}</p>}
                      {assigneeNames.length > 0 && <p className="mt-2 text-xs font-semibold text-text-muted">{assigneeNames.join(', ')}</p>}
                    </div>
                  </article>
                </li>;
              })}
              {canManage && <li><button type="button" className="mx-auto block rounded-full border border-dashed border-accent/50 px-3 py-1 text-xs font-semibold text-accent" onClick={() => setInsertAt((items.at(-1)?.sort_order || 0) + 10)}>+ Ajouter une activité à la fin</button></li>}
            </ol>
          )}
        </div>
      </div>
      {role && <BottomNav role={role} />}

      {insertAt !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <form onSubmit={addItem} className="card max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto dark:backdrop-blur-2xl">
            <ModalHeader title="Nouvelle activité" onClose={() => setInsertAt(null)} />
            <TimeRangePicker initialLabel="" />
            <div>
              <FieldLabel>Activité</FieldLabel>
              <input name="title" required autoFocus placeholder="Ex. DJ et sonorisation" className="input" />
            </div>
            <div>
              <FieldLabel>Département</FieldLabel>
              <input name="department" placeholder="Ex. Technique" className="input" />
            </div>
            <div>
              <FieldLabel>Détails et consignes</FieldLabel>
              <textarea name="details" placeholder="Déroulement, matériel et consignes…" className="input min-h-24" />
            </div>
            <button className="btn-primary w-full">Ajouter et partager</button>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <form
            className="card max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto dark:backdrop-blur-2xl"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const saved = await patchItem(editing.id, {
                time_label: form.get('time_label'),
                title: form.get('title'),
                department: form.get('department'),
                details: form.get('details'),
                assignee_ids: editing.assignee_ids,
                custom_assignees: editing.custom_assignees || [],
              });
              if (saved) openEditing(null);
            }}
          >
            <ModalHeader title="Modifier l’activité" onClose={() => openEditing(null)} />
            <TimeRangePicker key={editing.id} initialLabel={editing.time_label} />
            <div>
              <FieldLabel>Activité</FieldLabel>
              <input name="title" required defaultValue={editing.title} className="input" />
            </div>
            <div>
              <FieldLabel>Département</FieldLabel>
              <input name="department" defaultValue={editing.department} className="input" />
            </div>
            <div>
              <FieldLabel>Détails et consignes</FieldLabel>
              <textarea name="details" defaultValue={editing.details || ''} placeholder="Déroulement, matériel et consignes…" className="input min-h-24" />
            </div>
            <div>
              <FieldLabel>Responsables</FieldLabel>
              {/* Fiche de recherche plein ecran au lieu d'une longue liste
                  toujours depliee -- demande de Gersom le 02/09/2026 (capture
                  d'ecran a l'appui) : "au lieu d'avoir toute la liste des
                  responsables a defiler... un champ... quand je clique dessus
                  ca me demande de choisir la personne". */}
              <button
                type="button"
                onClick={() => setResponsablePickerOpen(true)}
                className="action-row flex items-center justify-between gap-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate">
                  {(() => {
                    const names = [
                      ...editing.assignee_ids.map((id) => peopleById.get(id)).filter(Boolean).map((p) => (p as Person).nom_complet || (p as Person).nom_affichage),
                      ...(editing.custom_assignees || []),
                    ];
                    return names.length > 0 ? names.join(', ') : 'Choisir les responsables';
                  })()}
                </span>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-text-faint" />
              </button>
            </div>
            <button type="submit" className="btn-primary w-full">Enregistrer et partager</button>
          </form>
        </div>
      )}

      {editing && responsablePickerOpen && (
        <ResponsablePicker
          people={people}
          selectedPersonIds={editing.assignee_ids}
          selectedCustomNames={editing.custom_assignees || []}
          onChange={({ assigneeIds, customNames }) => setEditing({ ...editing, assignee_ids: assigneeIds, custom_assignees: customNames })}
          onClose={() => setResponsablePickerOpen(false)}
        />
      )}
    </div>
  );
}
