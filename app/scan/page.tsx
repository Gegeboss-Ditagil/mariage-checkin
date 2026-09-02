'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QrScanner, type QrScannerHandle } from '@/components/QrScanner';
import { UserMenu } from '@/components/UserMenu';
import { BottomNav } from '@/components/BottomNav';
import { ScanStatsStrip } from '@/components/ScanStatsStrip';
import { createClient } from '@/lib/supabase/client';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { GuestApprovalCaptureFlow } from '@/components/GuestApprovalCaptureFlow';
import { GuestApprovalsShortcut } from '@/components/GuestApprovalsShortcut';
import { NextAgendaActivity } from '@/components/NextAgendaActivity';

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
  const scannerRef = useRef<QrScannerHandle>(null);
  const [approvalPhoto, setApprovalPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'looking' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  // useSessionRole lit le cookie après le premier rendu. Tant que `role`
  // vaut null, aucune caméra n'est montée : un badge déjà présenté ne peut
  // donc pas être traité comme un refus avant le chargement de la session.
  const roleReady = role !== null;

  const captureGuestPhoto = useCallback(async () => {
    setMessage(null);
    try {
      setApprovalPhoto(await scannerRef.current!.captureFrame());
    } catch {
      setStatus('error');
      setMessage("La caméra n'est pas encore prête. Attendez que l'image apparaisse, puis réessayez.");
    }
  }, []);

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
      // Ouvert à toute l'équipe d'accueil : les invitations Staff sans table
      // se présentent à l'entrée générale, tenue par placeur/agent scan.
      if (code.toUpperCase() === 'STAFF') {
        if (hasCapability(role, 'viewStaff')) {
          router.push('/staff');
        } else {
          setStatus('error');
          setMessage("L'écran Staff n'est pas accessible avec ce rôle.");
        }
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
    [role, router, status]
  );

  if (role === 'visibilite') {
    return <div className="flex h-dvh flex-col" />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden landscape:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden">
        <UserMenu />
        {/* La caméra utilise désormais la hauteur disponible du viewport au
            lieu d'un ratio horizontal trop petit. Le conteneur reste
            défilable sur les téléphones très courts. Boutons de
            navigation dupliques (Rechercher/Plan/Bord/Staff) retires le
            30/08/2026 au profit de la barre du bas partagee (BottomNav,
            maquette Atrium/Maison) : en plus d'etre coherent avec le reste de
            l'appli, ca libere la hauteur qui manquait en mode paysage/web
            large (le bouton Staff passait sous la ligne de flottaison sans
            pouvoir defiler jusqu'a lui). */}
        <div className="flex-1 overflow-y-auto px-4 pt-2">
          <p className="eyebrow">Staff</p>
          <h1 className="font-display text-xl">Scanner un QR code</h1>
          <p className="text-xs text-text-faint">Présentez le QR de l'invité devant la caméra</p>

          {/* Le bouton "Prendre une photo" sous la camera a ete retire le
              02/09/2026 (retour de Remy : "on n'en a pas besoin, on a le
              gros bouton en bas") -- captureGuestPhoto reste la meme
              fonction, declenchee par le bouton central de BottomNav. */}
          <div className="py-2">
            {roleReady ? (
              <QrScanner ref={scannerRef} onScan={handleScan} />
            ) : (
              <div className="flex h-[clamp(320px,46dvh,620px)] items-center justify-center rounded-xl2 bg-surface-2 text-text-faint">
                Chargement…
              </div>
            )}
          </div>

          {status === 'looking' && (
            <p className="text-center text-sm text-text-muted">Recherche de la table…</p>
          )}
          {status === 'error' && message && (
            <p className="rounded-xl2 bg-status-over/10 p-2.5 text-center text-sm font-medium text-status-over">
              {message}
            </p>
          )}

        </div>

        {/* Ordre de bas en haut demande par Gersom le 02/09/2026 : Bord
            (ScanStatsStrip), Approbations, puis juste au-dessus, la
            prochaine activite du chronogramme -- la camera garde le haut de
            la page. */}
        {role && <NextAgendaActivity role={role} />}
        {role && <GuestApprovalsShortcut role={role} />}
        {role && <ScanStatsStrip />}
      </div>
      {role && <BottomNav role={role} onCentralAction={hasCapability(role, 'submitGuestApproval') ? captureGuestPhoto : undefined} />}
      {approvalPhoto && <GuestApprovalCaptureFlow photo={approvalPhoto} onClose={() => setApprovalPhoto(null)} />}
    </div>
  );
}

