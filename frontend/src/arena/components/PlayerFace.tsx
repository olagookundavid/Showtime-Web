import { initialsOf } from '../utils';

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' } as const;

/** A player's picture, or their initials on navy when they have none. */
export const PlayerFace = ({ name, src, size = 'md' }: { name: string; src?: string; size?: keyof typeof sizes }) =>
  src ? (
    <img src={src} alt="" loading="lazy" className={`${sizes[size]} shrink-0 rounded-full object-cover bg-gray-100`} />
  ) : (
    <span aria-hidden="true" className={`${sizes[size]} shrink-0 inline-flex items-center justify-center rounded-full bg-sffl-navy font-black text-arena-lime dark:bg-white/10`}>
      {initialsOf(name)}
    </span>
  );
