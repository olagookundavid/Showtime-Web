import { describeRemaining, splitDuration, useServerCountdown } from './potwUtils';

interface POTWCountdownProps {
    target: string;
    serverTime: string;
    label: string;
    onElapsed?: () => void;
    /** Light text for use on the navy hero; dark text on cards. */
    onDark?: boolean;
}

/** Days / hours / minutes / seconds tiles counting down to `target`. */
export const POTWCountdown = ({ target, serverTime, label, onElapsed, onDark = false }: POTWCountdownProps) => {
    const remaining = useServerCountdown(target, serverTime, onElapsed);
    const { days, hours, minutes, seconds } = splitDuration(remaining);
    const units: [string, number][] = [
        ['Days', days],
        ['Hours', hours],
        ['Mins', minutes],
        ['Secs', seconds],
    ];

    return (
        <div role="timer" aria-label={`${label}: ${describeRemaining(remaining)}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${onDark ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {label}
            </p>
            <div className="grid grid-cols-4 gap-2 max-w-xs" aria-hidden="true">
                {units.map(([unit, value]) => (
                    <div
                        key={unit}
                        className={`rounded-xl px-2 py-2 text-center ${
                            onDark
                                ? 'bg-white/10 border border-white/15 text-white'
                                : 'bg-gray-100 dark:bg-gray-700/60 text-sffl-navy dark:text-white'
                        }`}
                    >
                        <span className="block text-xl sm:text-2xl font-black tabular-nums leading-none">
                            {String(value).padStart(2, '0')}
                        </span>
                        <span className={`block text-[10px] font-bold uppercase mt-1 ${onDark ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                            {unit}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
