// Shared look for text-like form controls. Input, Textarea and Select use these,
// so every form field matches. Horizontal padding is added by each control, so an
// icon can take its own side. Text is 16px on phones because iOS zooms into
// anything smaller when the field is focused.
export const fieldControlClass =
    'w-full py-2.5 rounded-lg text-base sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 placeholder:text-gray-400 read-only:bg-gray-100 dark:read-only:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-sffl-red focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// Same controls for a dark surface (hero bars, dark headers). Used when `tone="dark"`.
export const fieldControlDarkClass =
    'w-full py-2.5 rounded-lg text-base sm:text-sm text-white bg-white/10 border border-white/25 placeholder:text-white/50 read-only:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const fieldInvalidClass = 'border-red-500 dark:border-red-500 focus:ring-red-500';
