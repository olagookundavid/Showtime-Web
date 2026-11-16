import type { LeadInterest } from '../types';

/** The things someone can ask to hear about, in the order the join form shows them. */
export const LEAD_INTERESTS: { value: LeadInterest; label: string; hint: string }[] = [
    { value: 'watch', label: 'Watch games', hint: 'Game-day invitations to come and watch.' },
    { value: 'coaches', label: 'Meet the coaches', hint: 'Chances to meet our coaches.' },
    { value: 'play', label: 'Play flag football', hint: 'Find out how to join a team.' },
];

export const leadInterestLabel = (value: string) =>
    LEAD_INTERESTS.find((i) => i.value === value)?.label ?? value;

/** Channels the community team shares the join link on. `src` in the link says which. */
export const LEAD_SHARE_CHANNELS = ['instagram', 'whatsapp', 'twitter', 'facebook', 'tiktok', 'poster'] as const;
