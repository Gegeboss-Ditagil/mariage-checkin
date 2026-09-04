'use client';

import { useEffect, useState } from 'react';
import { useOnline } from '@/hooks/useOnline';
import type { Cote } from '@/lib/types';

type Step = 'cote' | 'form' | 'submitting' | 'done';

export function GuestApprovalCaptureFlow({
  photo,
  onClose,
  initialCote,
  linkedInvitationId,
  linkedLabel,
}: {
  photo: File;
  onClose: () => void;
  // Cote deja connue et lien vers l'invitation du groupe avec qui la
  // personne est arrivee -- demande de Gersom le 02/09/2026 (voir
  // 0046_guest_approval_linked_invitation.sql) : depuis
  // /checkin/[invitationId], le cote est deja celui du groupe courant, pas
  // besoin de le redemander. Absent depuis /scan (aucune invitation connue).
  initialCote?: Exclude<Cote, 'Neutre'>;
  linkedInvitationId?: string;
  linkedLabel?: string;
}) {
  const online = useOnline();
  const [step, setStep] = useState<Step>(initialCote ? 'form' : 'cote');
  const [cote, setCote] = useState<Cote | null>(initialCote ?? null);
  const [nomInvite, setNomInvite] = useState('');
  const [nombreInvites, setNombreInvites] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ approverNom: string; smsSent: boolean; smsError: string | null } | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Corrige une alerte CodeQL ("DOM text reinterpreted as HTML") sur le
  // rendu de `preview` en tant que src d'image : `preview` ne peut en
  // pratique jamais etre autre chose qu'une URL blob: locale creee ci-dessus
  // par URL.createObjectURL, mais l'analyse statique ne peut pas le prouver
  // a partir du seul type `string`. Ce garde-fou explicite (prefixe
  // whitelist) rend la contrainte verifiable et empeche toute valeur autre
  // qu'une blob: locale d'atteindre l'attribut src.
  const safePreview = preview.startsWith('blob:') ? preview : '';

  async function submit() {
    if (!cote || !nomInvite.trim()) return;
    setStep('submitting');
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('cote', cote);
      form.append('nom_invite', nomInvite.trim());
      form.append('nombre_invites', String(nombreInvites));
      if (linkedInvitationId) form.append('invitation_id', linkedInvitationId);
      const response = await fetch('/api/guest-approvals', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Échec de la demande');
      setConfirmation({ approverNom: data.approver_nom, smsSent: data.sms_sent, smsError: data.sms_error });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau — réessayez');
      setStep('form');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-xl safe-top safe-bottom">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div>
          <p className="eyebrow">Invité surprise</p>
          <h2 className="font-display text-xl">Demande d’approbation</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">
          Fermer
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {safePreview && <img src={safePreview} alt="Photo prise depuis le scanner" className="mx-auto max-h-[42dvh] rounded-xl2 border border-hairline object-contain" />}

        {step === 'cote' && (
          <div className="space-y-3">
            <p className="text-center font-semibold">De quel côté est cette personne ?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-primary" onClick={() => { setCote('Gege'); setStep('form'); }}>Côté Gégé</button>
              <button type="button" className="btn-primary" onClick={() => { setCote('Nelly'); setStep('form'); }}>Côté Nelly</button>
            </div>
          </div>
        )}

        {(step === 'form' || step === 'submitting') && cote && (
          <div className="card space-y-4">
            {linkedLabel && (
              <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Arrivé(e) avec {linkedLabel}</p>
            )}
            <p className="font-semibold text-accent">Côté {cote === 'Gege' ? 'Gégé' : 'Nelly'}</p>
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-faint">Nom</label>
            <input autoFocus value={nomInvite} onChange={(event) => setNomInvite(event.target.value)} placeholder="Prénom Nom" className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Nombre d’invités</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setNombreInvites((value) => Math.max(1, value - 1))} className="h-11 w-11 rounded-xl2 border border-hairline text-xl">−</button>
                <span className="text-xl font-bold tabular-nums">{nombreInvites}</span>
                <button type="button" onClick={() => setNombreInvites((value) => value + 1)} className="h-11 w-11 rounded-xl2 border border-hairline text-xl">+</button>
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-status-over">{error}</p>}
            <button type="button" className="btn-primary w-full" disabled={!online || !nomInvite.trim() || step === 'submitting'} onClick={submit}>
              {step === 'submitting' ? 'ENVOI…' : online ? 'ENVOYER POUR APPROBATION' : 'HORS LIGNE'}
            </button>
            <button type="button" className="action-row-muted" onClick={() => setStep('cote')}>Changer de côté</button>
          </div>
        )}

        {step === 'done' && confirmation && (
          <div className="card space-y-3 text-center">
            <p className="text-3xl">✅</p>
            <p className="text-lg font-semibold">Approbation en attente</p>
            <p className="text-sm text-text-muted">La demande est visible immédiatement dans l’application pour les approbateurs.</p>
            {!confirmation.smsSent && <p className="text-sm font-medium text-status-over">Le message Twilio n’est pas parti ({confirmation.smsError}). La demande reste disponible dans l’application.</p>}
            <button type="button" className="btn-primary w-full" onClick={onClose}>Retour au scanner</button>
          </div>
        )}
      </div>
    </div>
  );
}
