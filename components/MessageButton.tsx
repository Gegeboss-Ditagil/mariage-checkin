'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PhoneIcon } from '@/components/icons';

// Bouton d'appel direct (tel:) : pastille verte pleine (--status-complete,
// identique dans les deux themes) avec combiné blanc -- maquette de
// reference (Ecrans Atrium Maison.dc.html, /staff et /plan-table). `compact`
// pour les lignes plus denses (plan-table) : pastille plus petite.
export function CallButton({ telephone, name, compact }: { telephone: string; name: string; compact?: boolean }) {
  return (
    <a
      href={'tel:' + telephone}
      onClick={(e) => e.stopPropagation()}
      aria-label={'Appeler ' + name}
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-status-complete text-white shadow-card',
        compact ? 'h-9 w-9' : 'h-11 w-11'
      )}
    >
      <PhoneIcon className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
    </a>
  );
}

export function MessageButton({ telephone, name, compact }: { telephone: string; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const digits = telephone.replace(/[^\d]/g, '');
  const smsNumber = telephone.trim().replace(/(?!^)\+|[^\d+]/g, '');

  if (!digits) return null;

  if (open) {
    return (
      <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Pastille verte WhatsApp officielle (#25D366) avec combiné blanc --
            maquette de reference (Propositions.dc.html), a suivre a la
            lettre : 44px, pas de teinte pastel comme les autres actions. */}
        <a
          href={'https://wa.me/' + digits}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={'WhatsApp à ' + name}
          onClick={() => setOpen(false)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-card active:scale-95 transition-transform"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="#ffffff">
            <path d="M17.5 14.4c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.04-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.35.2 1.86.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
            <path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.83.5 3.6 1.44 5.14L2 22l4.98-1.41A9.96 9.96 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2Zm0 18.15c-1.67 0-3.3-.45-4.72-1.3l-.34-.2-3.02.86.86-2.93-.22-.35A8.16 8.16 0 0 1 3.83 12c0-4.53 3.68-8.2 8.19-8.2 4.52 0 8.2 3.67 8.2 8.2 0 4.52-3.68 8.15-8.2 8.15Z" />
          </svg>
        </a>
        <a href={'sms:' + smsNumber} aria-label={'SMS à ' + name} onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-sm text-accent">✉️</a>
        <button type="button" aria-label="Annuler" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-sm text-text-faint">✕</button>
      </span>
    );
  }

  return (
    <button type="button" aria-label={'Envoyer un message à ' + name} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={clsx('shrink-0 rounded-full text-sm', compact ? 'p-2 text-accent' : 'bg-accent-tint p-2.5 text-accent')}>💬</button>
  );
}
