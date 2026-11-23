import type { ArenaClubRef } from '../../types';

const sizes = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
} as const;

interface CrestProps {
  club: Pick<ArenaClubRef, 'name' | 'short' | 'color' | 'crest_url'>;
  size?: keyof typeof sizes;
  className?: string;
}

/** A club's badge: its uploaded crest, or its abbreviation on its colour. */
export const Crest = ({ club, size = 'md', className = '' }: CrestProps) =>
  club.crest_url ? (
    <img
      src={club.crest_url}
      alt=""
      loading="lazy"
      className={`${sizes[size]} shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-white/10 ${className}`}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{ backgroundColor: club.color }}
      className={`${sizes[size]} shrink-0 inline-flex items-center justify-center rounded-lg font-black tracking-wide text-white ${className}`}
    >
      {club.short}
    </span>
  );
