import type { StatusTone } from './StatusBadge';

/** The badge tone for each contract status. */
export const contractTone = (status: string): StatusTone => {
  if (status === 'signed') return 'success';
  if (status === 'rejected' || status === 'release_declined') return 'danger';
  if (status === 'withdrawn') return 'neutral';
  return 'pending';
};
