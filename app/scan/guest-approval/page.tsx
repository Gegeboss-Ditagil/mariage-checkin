'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useOnline } from '@/hooks/useOnline';
import { hasCapability } from '@/lib/permissions';
import { Cote } from '@/lib/types';

type Step = 'photo' | 'cote' | 'form' | 'submitting' | 'done';

/**
 * Invité surprise avec approbation SMS à distance (v1.27.0) -- demande de
 * Gersom : photo -> côté -> nom/nombre -> SMS à l'approbateur (Papa Gégé ou
 * Papa David selon le côté). Réservé à la capacité guestApproval
 * (admin/directeur/placeur) -- jamais agent scan : "si le scanner voit des
 * personnes en plus, il ne fait rien, il va voir le placeur directement".
 *
 * <input type="file" capture="environment"> plutôt que getUserMedia : plus
 * fiable en PWA iOS/Android (pas de gestion manuelle du flux vidéo, voir le
 * prompt de handoff).
 */
export default function GuestApprovalPage() {
  const router = useRouter();
  const role = useSessionRole();
  const online = useOnline();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('photo');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cote, setCote] = useState<Cote | null>(null);
  const [nomInvite, setNomInvite] = useState('');
  const [nombreInvites, setNombreInvites] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ approverNom: string; smsSent: boolean; smsError: string | null } | null>(null);

  if (role && !hasCapability(role, 'guestApproval')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <TopBar title="Invité surprise" backHref="/scan" />
        <p className="mt-8 text-lg font-semibold">Accès réservé</p>
        <p className="text-sm text-text-faint">
          Seuls l'admin, les directeurs de festin et les agents placeurs peuvent gérer un invité surprise. Voyez un
          agent placeur directement.
        </p>
      </div>
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setStep('cote');
  }

  async function handleSubmit() {
    if (!photo || !cote || !nomInvite.trim()) return;
    setStep('submitting');
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('cote', cote);
      form.append('nom_invite', nomInvite.trim());
      form.append('nombre_invites', String(nombreInvites));

      const res = await fetch('/api/guest-approvals', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la création de la demande');
        setStep('form');
        return;
      }
      setConfirmation({ approverNom: data.approver_nom, smsSent: data.sms_sent, smsError: data.sms_error });
      setStep('done');
    } catch {
      setError('Erreur réseau — réessayez');
      setStep('form');
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar title="Invité surprise" backHref={step === 'photo' || step === 'done' ? '/scan' : undefined} />

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {step === 'photo' && (
          <div className="card space-y-3 text-center">
            <p className="text-sm text-text-muted">
              Prenez une photo de la personne — elle sera envoyée par lien (jamais en pièce jointe SMS) au parent
              concerné pour approbation avant de la laisser entrer.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button type="button" className="btn-primary w-full" onClick={() => fileInputRef.current?.click()}>
              📷 Prendre une photo
            </button>
          </div>
        )}

        {step === 'cote' && photoPreview && (
          <div className="space-y-4">
            <img src={photoPreview} alt="" className="mx-auto max-h-64 rounded-xl2 border border-hairline object-cover" />
            <p className="text-center text-sm font-semibold text-text-muted">De quel côté est cette personne ?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setCote('Gege'); setStep('form'); }}
                className="btn-tap flex-col gap-1 border-2 border-hairline bg-surface text-text shadow-card"
              >
                <span className="text-base">Côté Gégé</span>
              </button>
              <button
                type="button"
                onClick={() => { setCote('Nelly'); setStep('form'); }}
                className="btn-tap flex-col gap-1 border-2 border-hairline bg-surface text-text shadow-card"
              >
                <span className="text-base">Côté Nelly</span>
              </button>
            </div>
            <button type="button" className="action-row-muted" onClick={() => setStep('photo')}>
              ↩️ Reprendre la photo
            </button>
          </div>
        )}

        {(step === 'form' || step === 'submitting') && photoPreview && cote && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={photoPreview} alt="" className="h-16 w-16 shrink-0 rounded-xl2 border border-hairline object-cover" />
              <p className="text-sm font-semibold text-accent">Côté {cote === 'Gege' ? 'Gégé' : 'Nelly'}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">Nom</label>
              <input
                autoFocus
                className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
                placeholder="Prénom Nom"
                value={nomInvite}
                onChange={(e) => setNomInvite(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
                Nombre d'invités
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNombreInvites((n) => Math.max(1, n - 1))}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 border-2 border-hairline bg-surface text-xl font-bold"
                >
                  −
                </button>
                <span className="min-w-[3ch] text-center text-2xl font-bold tabular-nums">{nombreInvites}</span>
                <button
                  type="button"
                  onClick={() => setNombreInvites((n) => n + 1)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 border-2 border-hairline bg-surface text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {error && <p className="text-sm font-medium text-status-over">{error}</p>}
          </div>
        )}

        {step === 'done' && confirmation && (
          <div className="card space-y-2 text-center">
            <p className="text-3xl">✅</p>
            <p className="text-lg font-semibold">Demande envoyée à {confirmation.approverNom}</p>
            {!confirmation.smsSent && (
              <p className="text-sm font-medium text-status-over">
                Le SMS n'est pas parti ({confirmation.smsError}) — prévenez {confirmation.approverNom} directement en
                attendant. La demande reste visible dans « Approbations ».
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 px-4 pb-6">
        {step === 'form' && (
          <button
            className="btn-primary w-full"
            disabled={!online || !nomInvite.trim()}
            onClick={handleSubmit}
          >
            {!online ? 'HORS LIGNE' : 'ENVOYER LA DEMANDE'}
          </button>
        )}
        {step === 'submitting' && (
          <button className="btn-primary w-full" disabled>
            …
          </button>
        )}
        {step === 'done' && (
          <>
            <button className="btn-primary w-full" onClick={() => router.push('/approbations')}>
              VOIR LES APPROBATIONS
            </button>
            <button className="action-row-muted" onClick={() => router.push('/scan')}>
              Retour au scan
            </button>
          </>
        )}
      </div>
    </div>
  );
}
