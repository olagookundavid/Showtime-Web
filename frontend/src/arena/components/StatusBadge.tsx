import type { ReactNode } from 'react';

const tones = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
} as const;

export type StatusTone = keyof typeof tones;

/** A small label for a status. It is text, not a button. */
export const StatusBadge = ({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${tones[tone]}`}>{children}</span>
);

/** The badge tone for each contract status. */
export const contractTone = (status: string): StatusTone => {
  if (status === 'signed') return 'success';
  if (status === 'rejected' || status === 'release_declined') return 'danger';
  if (status === 'withdrawn') return 'neutral';
  return 'pending';
};
