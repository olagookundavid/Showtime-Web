const SKIP_KEY_PREFIX = 'sffl_confirm_skip:';

export const isConfirmSkipped = (key: string): boolean => {
    try {
        return localStorage.getItem(SKIP_KEY_PREFIX + key) === '1';
    } catch {
        return false; // storage blocked: fail open, just ask again
    }
};

export const setConfirmSkipped = (key: string): void => {
    try {
        localStorage.setItem(SKIP_KEY_PREFIX + key, '1');
    } catch {
        // storage blocked: the checkbox just won't be remembered
    }
};
