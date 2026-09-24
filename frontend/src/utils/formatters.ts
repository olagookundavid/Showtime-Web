/**
 * Formatting utilities for numbers and statistics across the Showtime Web application.
 * Ensures consistent thousand-delimiters (e.g., 1,333 or 380) for all statistical amounts.
 */

/**
 * Formats a stat value or count with thousand delimiters.
 * e.g., 1626 -> "1,626", 380 -> "380", 0 -> "0", "-" -> "-"
 */
export function formatStatNumber(val: number | string | null | undefined, fallback: string = '0'): string {
    if (val === null || val === undefined || val === '') return fallback;
    if (typeof val === 'number') {
        if (Number.isNaN(val)) return fallback;
        return val.toLocaleString('en-US');
    }
    const trimmed = String(val).trim();
    if (trimmed === '-' || trimmed === '—' || trimmed === 'N/A') return trimmed;
    const num = Number(trimmed);
    if (Number.isNaN(num)) return trimmed;
    return num.toLocaleString('en-US');
}

/**
 * Formats a decimal stat or points total with thousand delimiters and specified decimal places.
 * e.g., 1234.5 -> "1,234.5", 1234.567 with decimals=2 -> "1,234.57"
 */
export function formatStatDecimal(
    val: number | string | null | undefined,
    decimals: number = 1,
    fallback: string = '0'
): string {
    if (val === null || val === undefined || val === '') return fallback;
    const num = typeof val === 'number' ? val : Number(String(val).trim());
    if (Number.isNaN(num)) return String(val);
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
