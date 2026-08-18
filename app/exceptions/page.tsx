'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';

const TYPE_LABELS: Record<string, string> = {
  pas_de_qr: 'Pas de QR',
  nom_introuvable: 'Nom introuvable',
  nombre_superieur: 'Nombre supérieur au prévu',
  mauvaise_table: 'Mauvaise table',
  invite_non_prevu: 'Invité non prévu',
  qr_incorrect: 'QR incorrect',
  deja_marque_entre: 'Déjà marqué entré',
  capacite_insuffisante: 'Capacité insuffisante',
  autre: 'Autre',
};

interface ExceptionRow {
  id: string;
  type: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
}

export default function ExceptionsPage() {
  const role = useSessionRole();
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('autre');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.from('exceptions').select('*').order('created_at', { ascending: false });
      if (active) setExceptions((data as ExceptionRow[]) || []);
    }

    load();
    const channel = supabase
      .channel('exceptions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exceptions' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description }),
    });
    setDescription('');
    setShowForm(false);
  }

  async function resolve(id: string) {
    await fetch(`/api/exceptions/${id}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  }

  const open = exceptions.filter((e) => !e.resolved);
  const resolved = exceptions.filter((e) => e.resolved);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Exceptions"
        right={
          <button className="text-sm font-semibold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Annuler' : '+ Signaler'}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={submit} className="space-y-3 border-b border-black/5 px-4 py-4">
          <select
            className="w-full rounded-xl2 border border-black/10 px-4 py-3"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-xl2 border border-black/10 px-4 py-3"
            placeholder="Détails (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="btn-primary w-full">
            Envoyer au responsable
          </button>
        </form>
      )}

      <div className="flex-1 px-4 py-4">
        <p className="mb-2 text-sm font-semibold text-black/50">En attente ({open.length})</p>
        <ul className="mb-6 space-y-2">
          {open.map((e) => (
            <li key={e.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold">{TYPE_LABELS[e.type] || e.type}</p>
                {e.description && <p className="text-sm text-black/50">{e.description}</p>}
              </div>
              <button className="btn-secondary px-4 py-2 text-sm" onClick={() => resolve(e.id)}>
                Résoudre
              </button>
            </li>
          ))}
          {open.length === 0 && <p className="text-black/40">Aucune exception en attente</p>}
        </ul>

        {resolved.length > 0 && (
          <>
            <p className="mb-2 text-sm font-semibold text-black/50">Résolues</p>
            <ul className="space-y-2 opacity-50">
              {resolved.map((e) => (
                <li key={e.id} className="card">
                  <p className="font-semibold">{TYPE_LABELS[e.type] || e.type}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}
