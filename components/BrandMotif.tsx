// Petits elements decoratifs partages (sceau, trajectoire en pointilles,
// ciel etoile) utilises sur les ecrans d'accueil / connexion pour retrouver
// l'esprit "voyage" du sceau N&G sur toutes les pages de l'app.

export function GoldSeal({ size = 128, className }: { size?: number; className?: string }) {
  // Sceau autonome (pas d'image externe requise) : cercle dore avec
  // monogramme, pour eviter toute dependance a un fichier image absent.
  return (
    <div
      className={
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold-400/70 bg-night-800 shadow-gold ' +
        (className || '')
      }
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-semibold text-gold-200"
        style={{ fontSize: size * 0.34 }}
      >
        N&amp;G
      </span>
    </div>
  );
}

export function FlightPath({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 160"
      fill="none"
      aria-hidden="true"
      className={'pointer-events-none ' + (className || '')}
    >
      <path
        d="M10 130 C 80 40, 160 190, 230 60 S 300 20, 310 15"
        stroke="#d4af6a"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <g transform="translate(295, 8) rotate(35)">
        <path
          d="M0 6 L14 0 L0 -6 L3 0 Z"
          fill="#ecd9a8"
          fillOpacity="0.85"
        />
      </g>
    </svg>
  );
}

export function StarField({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={'pointer-events-none absolute inset-0 opacity-[0.35] ' + (className || '')}
      style={{
        backgroundImage:
          'radial-gradient(1px 1px at 20% 20%, rgba(246,241,228,0.7) 0, transparent 60%), ' +
          'radial-gradient(1px 1px at 70% 15%, rgba(246,241,228,0.6) 0, transparent 60%), ' +
          'radial-gradient(1.5px 1.5px at 85% 35%, rgba(212,175,106,0.7) 0, transparent 60%), ' +
          'radial-gradient(1px 1px at 40% 45%, rgba(246,241,228,0.5) 0, transparent 60%), ' +
          'radial-gradient(1px 1px at 55% 70%, rgba(246,241,228,0.6) 0, transparent 60%), ' +
          'radial-gradient(1.5px 1.5px at 15% 65%, rgba(212,175,106,0.6) 0, transparent 60%), ' +
          'radial-gradient(1px 1px at 90% 80%, rgba(246,241,228,0.5) 0, transparent 60%)',
      }}
    />
  );
}

export function EiffelSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 140"
      fill="none"
      aria-hidden="true"
      className={'pointer-events-none ' + (className || '')}
    >
      <g stroke="#d4af6a" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5">
        <path d="M50 4 L50 20" />
        <path d="M38 30 L50 4 L62 30" />
        <path d="M28 55 L50 20 L72 55" />
        <path d="M18 82 L50 30 L82 82" />
        <path d="M10 136 L50 55 L90 136" />
        <path d="M20 82 L80 82" />
        <path d="M14 108 L86 108" />
        <path d="M25 55 L75 55" />
        <path d="M40 30 L60 30" />
      </g>
    </svg>
  );
}
