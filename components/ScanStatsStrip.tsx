'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { CapacityGauge } from '@/components/CapacityGauge';
import { debounce } from '@/lib/debounce';

// Bande compacte d'information de base entre l'ecran de scan et la barre de
// navigation (30/08/2026, demande de Gersom : "en dessous de l'ecran scan,
// les boutons du bas vont etre un peu plus haut, il va juste rester un
// petit espace ... avec de l'information de base du tableau de bord --
// exemple le nombre d'invites, le nombre arrives, la progression du
// remplissage de la salle"). Memes agregats que /dashboard
// (nombre_prevu/nombre_arrive, capacite des tables), en une seule ligne +
// jauge compacte -- ouvre le tableau de bord complet au tap.
export function ScanStatsStrip() {
  const [attendus, setAttendus] = useState(0);
  const [arrives, setArrives] = useState(0);
  const [capaciteTotale, setCapaciteTotale] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const supabase = createClient();

    async function load() {
      const [{ data: invs }, { data: tbls }] = await Promise.all([
        supabase.from('invitations').select('nombre_prevu, nombre_arrive'),
        supabase.from('tables').select('capacity'),
      ]);
      if (!activeRef.current) return;
      const invitations = (invs as Pick<InvitationRow, 'nombre_prevu' | 'nombre_arrive'>[]) || [];
      setAttendus(invitations.reduce((s, i) => s + i.nombre_prevu, 0));
      setArrives(invitations.reduce((s, i) => s + i.nombre_arrive, 0));
      setCapaciteTotale(((tbls as Pick<TableRow, 'capacity'>[]) || []).reduce((s, t) => s + t.capacity, 0));
    }

    load();

    // Regroupe une rafale d'evenements (reimport CSV, correction en lot) en
    // un seul rechargement -- meme principe que /dashboard (lib/debounce.ts).
    const debouncedLoad = debounce(load, 400);
    const channel = supabase
      .channel('scan-stats-strip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, debouncedLoad)
      .subscribe();

    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const remplissage = capaciteTotale > 0 ? (arrives / capaciteTotale) * 100 : 0;

  return (
    <Link
      href="/dashboard"
      aria-label={'Voir le tableau de bord complet — ' + arrives + ' arrivés sur ' + attendus + ' attendus'}
      className="mx-auto mb-3 flex min-h-[72px] w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center gap-4 rounded-2xl border border-hairline bg-glass px-5 py-3.5 shadow-card backdrop-blur-xl active:scale-[0.98] transition-transform landscape:mx-2 landscape:mb-3 landscape:w-auto landscape:max-w-none"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-muted">
          <span className="text-base font-bold text-text">{arrives}</span> / {attendus} arrivés
        </p>
        <div className="mt-1">
          <CapacityGauge percent={remplissage} size="md" showLabel={false} />
        </div>
      </div>
      <p className="shrink-0 text-base font-bold tabular-nums text-accent">{Math.round(remplissage)}%</p>
    </Link>
  );
}
