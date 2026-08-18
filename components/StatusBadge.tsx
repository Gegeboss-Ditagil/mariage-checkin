import { InvitationStatut, STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import clsx from 'clsx';

export function StatusBadge({ statut, className }: { statut: InvitationStatut; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white',
        STATUS_COLORS[statut],
        className
      )}
    >
      {STATUS_LABELS[statut]}
    </span>
  );
}
