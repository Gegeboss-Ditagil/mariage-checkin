'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { QrScanner } from '@/components/QrScanner';
import { createClient } from '@/lib/supabase/client';

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'looking' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

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

      const supabase = createClient();
      // ilike (insensible a la casse) : les QR imprimes peuvent encoder le code
      // en majuscules/minuscules differemment de ce qui est stocke en base.
      const { data: qr, error } = await supabase
        .from('qr_codes')
        .select('table_id')
        .ilike('code', code)
        .maybeSingle();

      if (error || !qr) {
        setStatus('error');
        setMessage(`QR non reconnu (${code}). Essayez la recherche manuelle.`);
        return;
      }

      router.push(`/table/${qr.table_id}`);
    },
    [router, status]
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pt-4">
        <h1 className="font-display text-2xl">Scanner un QR code</h1>
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
        <Link href="/search" className="btn-secondary w-full">
          Rechercher un invité
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/tables" className="btn-secondary">
            Tables
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
