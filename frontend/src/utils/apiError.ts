import { isAxiosError } from 'axios';

/** The backend's `{ error }` (or `{ message }`) text for a failed request, or `fallback` for anything else. */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
    if (!isAxiosError<{ error?: string; message?: string }>(err)) return fallback;
    return err.response?.data?.error || err.response?.data?.message || fallback;
};
