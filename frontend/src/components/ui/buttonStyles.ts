export type Variant = 'primary' | 'navy' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'link' | 'success' | 'info' | 'warning' | 'gold';
export type Size = 'sm' | 'md' | 'lg';
export type Tone = 'light' | 'dark';
/** `square` drops the corner radius for pages that use sharp, catalogue-style edges (the store). */
export type Shape = 'round' | 'square' | 'circle';

const baseStyles = 'inline-flex items-center justify-center gap-2 min-h-11 font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100';

const variantStyles: Record<Variant, string> = {
    primary: 'bg-sffl-red hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 focus:ring-red-500',
    navy: 'bg-sffl-navy hover:bg-blue-900 text-white dark:bg-sffl-navy dark:hover:bg-blue-900 focus:ring-sffl-navy',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 focus:ring-gray-400',
    outline: 'border-2 border-sffl-navy hover:bg-sffl-navy hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-sffl-navy focus:ring-sffl-navy',
    danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500',
    ghost: 'bg-transparent text-sffl-navy hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 focus:ring-gray-400',
    link: 'bg-transparent text-sffl-red hover:underline dark:text-red-400 focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700 focus:ring-green-500',
    info: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 focus:ring-blue-500',
    warning: 'bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-600 dark:hover:bg-orange-700 focus:ring-orange-500',
    gold: 'bg-sffl-gold hover:bg-sffl-gold/90 text-sffl-navy focus:ring-sffl-gold',
};

// Only the variants that change on a dark surface. The rest (primary, danger, success, info, warning) read the same on both.
const darkVariantStyles: Partial<Record<Variant, string>> = {
    navy: 'bg-white text-sffl-navy hover:bg-gray-100 focus:ring-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white focus:ring-white/60',
    outline: 'border-2 border-white text-white hover:bg-white hover:text-sffl-navy focus:ring-white',
    ghost: 'bg-transparent text-white hover:bg-white/10 focus:ring-white/60',
    link: 'bg-transparent text-white/90 hover:text-white hover:underline focus:ring-white/60',
};

const sizeStyles: Record<Size, string> = {
    sm: 'px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-xs',
    md: 'px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm',
    lg: 'px-4 py-2 text-sm md:px-6 md:py-3 md:text-base'
};

export const iconSize: Record<Size, string> = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
};

export const shapeStyles: Record<Shape, string> = {
    round: 'rounded-lg',
    square: 'rounded-none',
    circle: 'rounded-full',
};

/** Button classes for an element that is not a `<button>` (an external `<a>`). */
export const buttonClass = (variant: Variant, size: Size, fullWidth: boolean, className: string, tone: Tone = 'light', shape: Shape = 'round') =>
    `${baseStyles} ${shapeStyles[shape]} ${(tone === 'dark' && darkVariantStyles[variant]) || variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
