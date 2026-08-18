import Link from 'next/link';

export function TopBar({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-parchment/95 backdrop-blur px-4 py-3 border-b-2 border-gold-300">
      <div className="flex items-center gap-2 min-w-0">
        {backHref && (
          <Link href={backHref} className="text-2xl leading-none px-1 -ml-1 text-ink" aria-label="Retour">
            ‹
          </Link>
        )}
        <h1 className="font-display text-xl tracking-wide truncate">{title}</h1>
      </div>
      {right}
    </header>
  );
}
