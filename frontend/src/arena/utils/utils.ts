import type { ArenaContractStatus, ArenaMatch, ArenaSquadRole } from '../../types';

/** Every time in Arena is shown in West Africa Time, wherever the visitor is. */
const TZ = 'Africa/Lagos';

export const formatKickoffTime = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso))
    : 'TBC';

export const formatMatchDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso))
    : 'Date TBC';

export const formatLongDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso))
    : 'Date to be confirmed';

/** A plain yyyy-mm-dd date (no time) as "12 Oct 2026". */
export const formatDateOnly = (date: string | null | undefined): string => {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};

export const formatDateTime = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(iso))
    : '';

/** An ISO instant as the value of a datetime-local input, in Lagos time. */
export const toLagosInput = (iso: string | null): string => {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  return parts.replace(' ', 'T');
};

/** A datetime-local value, read as Lagos time, as an ISO instant. */
export const fromLagosInput = (value: string): string => new Date(`${value}:00+01:00`).toISOString();

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'] as const;

export const PLATFORMS = [
  { value: 'PS', label: 'PlayStation' },
  { value: 'XBOX', label: 'Xbox' },
  { value: 'PC', label: 'PC' },
] as const;

export const SQUAD_ROLES: { value: ArenaSquadRole; label: string }[] = [
  { value: 'first_team', label: 'First team' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'reserve', label: 'Reserve' },
];

export const squadRoleLabel = (role: string | undefined): string => SQUAD_ROLES.find((r) => r.value === role)?.label ?? '';

export const CONTRACT_STATUS_LABEL: Record<ArenaContractStatus, string> = {
  awaiting_release: 'Awaiting release',
  awaiting_player: 'Awaiting player',
  signed: 'Signed',
  rejected: 'Rejected',
  release_declined: 'Release declined',
  withdrawn: 'Withdrawn',
};

export const STAGE_LABEL: Record<string, string> = { league: 'League', semi: 'Semi-final', final: 'Final' };

/** "Matchweek 12", "Semi-final" or "Final". */
export const matchRound = (m: Pick<ArenaMatch, 'stage' | 'matchweek'>): string =>
  m.stage === 'league' ? `Matchweek ${m.matchweek}` : STAGE_LABEL[m.stage];

export const formatNaira = (n: number): string => `₦${n.toLocaleString('en-NG')}`;

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** The message to show for a failed request: the server's own words when it sent some. */
export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
};

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
