/** Decorative pitch line art for a dark Showtime-navy hero panel. Position, size and colour come from `className`. */
export const HeroPitchArt = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 300 200" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 10h260v180H20zM150 10v180" />
    <circle cx="150" cy="100" r="34" />
    <path d="M20 60h42v80H20M280 60h-42v80h42" />
  </svg>
);
