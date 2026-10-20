import type { ComponentType, SVGProps } from 'react';
import { RocketLaunchIcon, TicketIcon } from '@heroicons/react/24/outline';
import { FootballIcon, HandshakeIcon, PitchIcon } from '../icons';

type FaqIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** The icons an FAQ category can show, by the name stored with the category.
 *  To offer another, add it here; the admin picker and the public pages both read this. */
export const FAQ_ICONS: Record<string, FaqIconComponent> = {
    football: FootballIcon,
    ticket: TicketIcon,
    handshake: HandshakeIcon,
    rocket: RocketLaunchIcon,
    pitch: PitchIcon,
};

export const FAQ_ICON_OPTIONS = [
    { value: 'football', label: 'Football' },
    { value: 'ticket', label: 'Ticket' },
    { value: 'handshake', label: 'Handshake' },
    { value: 'rocket', label: 'Rocket' },
    { value: 'pitch', label: 'Pitch' },
] as const;
