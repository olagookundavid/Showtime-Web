import type { ReactNode } from 'react';

/** The centred card the sign-in pages sit in. */
export const AuthCard = ({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) => (
  <div className="min-h-dvh flex items-center justify-center bg-gray-100 px-4 py-10 dark:bg-black">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:p-8 dark:border-white/10 dark:bg-sffl-navy">
      <div className="mb-6 text-center">
        <img src="/logo.svg" alt="Clubs Arena" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-3xl font-extrabold text-sffl-navy dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
      </div>
      {children}
      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">{footer}</div>
    </div>
  </div>
);
