import type { ArenaFormation } from '../../types';

export interface PitchSlot {
  /** The slot in the formation, 0 to 10. */
  index: number;
  /** What to show under the shirt: a gamertag, or a prompt like "Select player". */
  label: string;
  /** The shirt number, or null for an empty slot. */
  number: number | null;
  captain?: boolean;
  /** Makes the node a button (the team sheet editor); omit it for a read-only board. */
  onSelect?: () => void;
}

/** The lines of a football pitch, as an SVG behind the players. */
const PitchLines = () => (
  <svg viewBox="0 0 100 130" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6">
      <rect x="3" y="3" width="94" height="124" />
      <line x1="3" y1="65" x2="97" y2="65" />
      <circle cx="50" cy="65" r="11" />
      <rect x="25" y="3" width="50" height="20" />
      <rect x="38" y="3" width="24" height="8" />
      <rect x="25" y="107" width="50" height="20" />
      <rect x="38" y="119" width="24" height="8" />
    </g>
  </svg>
);

/** A formation drawn on a pitch, attackers at the top and the goalkeeper at the bottom. */
export const PitchBoard = ({ formation, slots, label }: { formation: ArenaFormation; slots: PitchSlot[]; label: string }) => (
  <div
    role="group"
    aria-label={label}
    className="relative mx-auto w-full max-w-md aspect-[10/13] overflow-hidden rounded-xl bg-linear-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900"
  >
    <PitchLines />
    {slots.map((s) => {
      const [x, y] = formation.coords[s.index] ?? [50, 50];
      const body = (
        <>
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black tabular ${
              s.number === null ? 'border-dashed border-white/70 bg-white/10 text-white' : 'border-white bg-sffl-navy text-arena-lime'
            }`}
          >
            {s.number ?? '+'}
          </span>
          <span className="mt-1 max-w-20 truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {s.label}
            {s.captain ? ' (C)' : ''}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">{formation.slots[s.index]}</span>
        </>
      );
      const style = { left: `${x}%`, top: `${y}%` };
      const cls = 'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center';
      return s.onSelect ? (
        <button
          key={s.index}
          type="button"
          onClick={s.onSelect}
          style={style}
          className={`${cls} min-h-11 min-w-11 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-arena-lime`}
          aria-label={`${formation.slots[s.index]}: ${s.label}. Change player`}
        >
          {body}
        </button>
      ) : (
        <div key={s.index} style={style} className={cls}>
          {body}
        </div>
      );
    })}
  </div>
);
