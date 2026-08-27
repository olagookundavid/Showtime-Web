import React from 'react';

/**
 * Shown when the signed-in account has no player record behind it.
 *
 * The backend answers /player-portal/contracts with 409 + code PLAYER_NOT_LINKED
 * for this case. It used to return an empty list, which was indistinguishable
 * from "no contracts yet" and left players staring at a blank portal with no
 * idea their claim was still waiting on a manager.
 */
export const NotLinkedNotice: React.FC = () => (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-6 md:p-8 space-y-4">
        <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">⏳</span>
            <div className="space-y-2">
                <h2 className="text-lg font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">
                    Your account isn't linked to a player yet
                </h2>
                <p className="text-sm text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    Contracts and transfers only appear here once your account is attached to your
                    player profile. That happens when your team manager approves your claim — it
                    isn't something an administrator can switch on directly.
                </p>
            </div>
        </div>

        <div className="rounded-xl bg-white/70 dark:bg-gray-800/50 border border-amber-200 dark:border-amber-800/40 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 mb-2">
                What to do
            </p>
            <ol className="text-sm text-amber-900/90 dark:text-amber-200/90 space-y-1.5 list-decimal list-inside">
                <li>Ask your team manager for your club's claim code.</li>
                <li>
                    Claim your profile at{' '}
                    <a href="/claim" className="font-bold underline hover:no-underline">
                        /claim
                    </a>{' '}
                    using that code.
                </li>
                <li>Your manager approves it from their Claims tab — then this page fills in.</li>
            </ol>
        </div>

        <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
            Already claimed? Your manager may not have approved it yet. Check with them before
            claiming again — a second claim won't speed it up.
        </p>
    </div>
);
