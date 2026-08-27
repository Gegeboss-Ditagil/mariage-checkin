'use client';

import { useState } from 'react';
import clsx from 'clsx';

export function MessageButton({ telephone, name, compact }: { telephone: string; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const digits = telephone.replace(/[^\d]/g, '');
  const smsNumber = telephone.trim().replace(/(?!^)\+|[^\d+]/g, '');

  if (!digits) return null;

  if (open) {
    return (
      <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <a href={'https://wa.me/' + digits} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp à ' + name} onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-sm text-[#128C7E]">💬</a>
        <a href={'sms:' + smsNumber} aria-label={'SMS à ' + name} onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-sm text-gold-700">✉️</a>
        <button type="button" aria-label="Annuler" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-sm text-black/40">✕</button>
      </span>
    );
  }

  return (
    <button type="button" aria-label={'Envoyer un message à ' + name} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={clsx('shrink-0 rounded-full text-sm', compact ? 'p-2 text-gold-700' : 'bg-gold-100 p-2.5 text-gold-700')}>💬</button>
  );
}
