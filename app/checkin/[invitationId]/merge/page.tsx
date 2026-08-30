'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { useOnline } from '@/hooks/useOnline';

interface Candidate extends InvitationRow {
  table?: TableRow | null;
}

/**
 * Fusionne l'invitation courante ("source") dans une autre invitation
 * existante ("cible") choisie par recherche de nom -- ex: regrouper un
 * accompagnant isole ("Accompagnant non-nommé") avec le groupe auquel il
 * appartient vraiment. Voir merge_invitations
 * (0021_rename_and_merge_invitations.sql) pour ce qui est reattache.
 */
export default function FusionnerInvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [source, setSource] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data: inv } = await supabase.from('invitations').select('*').eq('id', invitationId).maybeSingle();
      if (!active) return;
      if (!inv) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSource(inv as InvitationRow);

      const { data: all } = await supabase
        .from('invitations')
        .select('*, table:tables(*)')
        .neq('id', invitationId)
        .order('nom_affichage');
      if (!active) return;
      setCandidates((all as Candidate[]) || []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [invitationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 30);
    return candidates.filter((c) => c.nom_affichage.toLowerCase().includes(q)).slice(0, 30);
  }, [candidates, query]);

  const bothStaff = source?.category === 'Staff' && chosen?.category === 'Staff';

  async function handleConfirm() {
    if (!source || !chosen) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    const confirmMsg =
      'Fusionner « ' +
      source.nom_affichage +
      ' » (' + source.nombre_prevu + ' personne' + (source.nombre_prevu > 1 ? 's' : '') + ') dans « ' +
      chosen.nom_affichage +
      ' » ? Après fusion : ' + (chosen.nombre_prevu + source.nombre_prevu) + ' personnes prévues.' +
      (bothStaff
        ? '\n\n⚠️ Les deux sont marquées Staff : leur arrivée sera regroupée en une seule case à cocher.'
        : '');
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_invitation_id: source.id, target_invitation_id: chosen.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'source_not_found' || data.error === 'target_not_found'
            ? 'Une des deux invitations a été modifiée entre-temps — rechargez et réessayez.'
            : data.error || 'Échec de la fusion'
        );
        return;
      }
      router.push('/checkin/' + chosen.id);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Invitation introuvable</p>
        <button className="btn-primary" onClick={() => router.push('/scan')}>
          Retour au scan
        </button>
      </div>
    );
  }

  if (loading || !source) {
    return <div className="flex min-h-dvh items-center justify-center text-text-faint">Chargement…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Fusionner avec un autre groupe" backHref={'/checkin/' + source.id} />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">{source.nom_affichage}</p>
          <p className="mt-1 text-text-muted">
            {source.nombre_prevu} personne{source.nombre_prevu > 1 ? 's' : ''} prévue{source.nombre_prevu > 1 ? 's' : ''}
            {source.category === 'Staff' && ' · Staff'}
          </p>
        </div>

        <input
          className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3  placeholder:text-text-faint focus:border-accent focus:outline-none"
          placeholder="Rechercher le groupe de destination par nom…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-text-faint">Aucune invitation trouvée.</p>}
          {filtered.map((c) => {
            const selected = chosen?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChosen(c)}
                className={
                  'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                  (selected ? 'border-accent bg-accent-tint ' : 'border-hairline bg-surface ')
                }
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {c.nom_affichage}
                    {c.category === 'Staff' && (
                      <span className="ml-1.5 rounded bg-accent-tint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        Staff
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-text-faint">
                    {c.table ? 'Table ' + c.table.number : 'Sans table'}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm text-text-faint">
                  {c.nombre_prevu} personne{c.nombre_prevu > 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {chosen && (
          <div className="card border-2 border-accent/40 bg-accent-tint">
            <p className="text-sm font-semibold">
              Après fusion : {chosen.nombre_prevu + source.nombre_prevu} personne
              {chosen.nombre_prevu + source.nombre_prevu > 1 ? 's' : ''} prévue
              {chosen.nombre_prevu + source.nombre_prevu > 1 ? 's' : ''} dans « {chosen.nom_affichage} ».
            </p>
            {bothStaff && (
              <p className="mt-1 text-sm font-medium text-status-over">
                ⚠️ Les deux sont marquées Staff : leur arrivée sera regroupée en une seule case à cocher.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button className="btn-primary w-full" disabled={!chosen || submitting || !online} onClick={handleConfirm}>
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'FUSIONNER'}
        </button>
      </div>
    </div>
  );
}
