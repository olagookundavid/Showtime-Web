import type { ReactNode } from 'react';
import { HeroPitchArt } from '../../components';

/** The sign-in pages' frame: the form on the left, the Clubs Arena brand on the right (full width on phones). */
export const AuthCard = ({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) => (
  <div className="grid min-h-dvh bg-white dark:bg-black lg:grid-cols-2">
    <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-16">
      <div className="w-full max-w-md">
        <img src="/logo.svg" alt="Clubs Arena" className="mb-6 h-14 w-14 lg:hidden" />
        <h1 className="text-3xl font-extrabold text-sffl-navy dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">{footer}</div>
      </div>
    </div>

    <div className="relative hidden overflow-hidden bg-sffl-navy px-12 py-10 text-white lg:flex lg:flex-col lg:justify-center">
      <HeroPitchArt className="pointer-events-none absolute -right-16 -top-16 h-[120%] w-[120%] text-white/10" />
      <div className="relative max-w-sm">
        <img src="/logo.svg" alt="" className="h-14 w-14" />
        <p className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
          <span className="h-px w-8 bg-sffl-red" aria-hidden="true" />
          Clubs Arena
        </p>
        <h2 className="mt-4 text-4xl font-extrabold uppercase leading-none">
          Your club. Your game. <span className="text-sffl-gold">Your glory.</span>
        </h2>
        <p className="mt-4 text-white/75">
          One account for your player profile, your contracts and your club &mdash; seasons, fixtures and team sheets, all in one place.
        </p>
      </div>
    </div>
  </div>
);
