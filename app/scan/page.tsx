'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QrScanner } from '@/components/QrScanner';
import { UserMenu } from '@/components/UserMenu';
import { createClient } from '@/lib/supabase/client';
import { useSessionRole } from '@/hooks/useSessionRole';

// Enleve les accents, la casse et la ponctuation pour comparer des noms de
// ville de facon tolerante (ex: "GENEVE" doit correspondre a "Geneve").
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

export default function ScanPage() {
  const router = useRouter();
  const role = useSessionRole();
  const [status, setStatus] = useState<'idle' | 'looking' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Filet de securite cote client : le role "visibilite" ne doit jamais
  // pouvoir scanner. Le middleware bloque deja /scan pour ce role, mais un
  // bouton "retour" mal cible (ou le cache du service worker en PWA) peut
  // faire atterrir un compte visibilite ici quand meme -- ce garde-fou
  // renvoie aussitot vers le tableau de bord, sans jamais laisser
  // apparaitre la camera.
  useEffect(() => {
    if (role === 'visibilite') router.replace('/dashboard');
  }, [role, router]);

  const handleScan = useCallback(
    async (raw: string) => {
      if (status === 'looking') return;
      setStatus('looking');
      setMessage(null);

      // Le QR peut contenir soit une URL complete (https://domaine.com/table/12),
      // soit juste un identifiant (table-12). On extrait le code utile.
      let code = raw.trim();
      try {
        const url = new URL(raw);
        const parts = url.pathname.split('/').filter(Boolean);
        code = parts[parts.length - 1] || raw;
      } catch {
        // ce n'est pas une URL, on garde le texte brut
      }

      // Le badge collectif du personnel encode simplement STAFF : il ouvre
      // la liste dédiée sans tenter une recherche de table inexistante.
      if (code.toUpperCase() === 'STAFF') {
        router.push('/staff');
        return;
      }

      const supabase = createClient();
      // ilike (insensible a la casse) : les QR imprimes peuvent encoder le code
      // en majuscules/minuscules differemment de ce qui est stocke en base.
      const { data: qr } = await supabase
        .from('qr_codes')
        .select('table_id')
        .ilike('code', code)
        .maybeSingle();

      if (qr) {
        router.push('/table/' + qr.table_id);
        return;
      }

      // Repli : certaines cartes imprimees encodent le nom de la ville
      // (ex: "MIAMI") plutot que le code vol-tXXX stocke dans qr_codes, et
      // parfois sans les accents (ex: "GENEVE" pour "Geneve"). On recupere
      // toutes les tables et on compare en ignorant casse/accents/ponctuation.
      const { data: allTables } = await supabase.from('tables').select('id, label');
      const normalizedCode = normalize(code);
      const table = (allTables || []).find((t) => t.label && normalize(t.label) === normalizedCode);

      if (table) {
        router.push('/table/' + table.id);
        return;
      }

      setStatus('error');
      setMessage('QR non reconnu (' + code + '). Essayez la recherche manuelle.');
    },
    [router, status]
  );

  if (role === 'visibilite') {
    return <div className="flex min-h-dvh flex-col" />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <UserMenu />
      <div className="px-4 pt-4">
        <p className="eyebrow">Staff</p>
        <h1 className="font-display text-2xl ">Scanner un QR code</h1>
        <p className="text-sm text-black/50">Présentez le QR de l'invité devant la caméra</p>
      </div>

      <div className="px-4 py-4">
        <QrScanner onScan={handleScan} />
      </div>

      {status === 'looking' && (
        <p className="px-4 text-center text-black/60">Recherche de la table…</p>
      )}
      {status === 'error' && message && (
        <p className="mx-4 rounded-xl2 bg-status-over/10 p-3 text-center text-sm font-medium text-status-over">
          {message}
        </p>
      )}

      <div className="mt-auto space-y-3 px-4 pb-6">
        {/* Les deux boutons "Rechercher un invite" et "Invite sans Code QR"
            menaient tous les deux a /search (juste un mode de depart
            different) : fusionnes en un seul bouton le 19/08/2026 a la
            demande de Gersom. Le mode telephone reste choisissable depuis
            la page de recherche elle-meme si besoin. */}
        <Link href="/search" className="btn-secondary w-full">
          Rechercher un invité
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/tables" className="btn-secondary">
            Tables
          </Link>
          <Link href="/dashboard" className="btn-secondary text-center">
            Tableau de bord
          </Link>
        </div>
        <Link href="/staff" className="btn-secondary w-full text-center">
          Staff
        </Link>
      </div>
    </div>
  );
}

