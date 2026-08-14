import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { appSettingsApi } from '../services/api';

export interface AppFontOption {
    id: string;
    name: string;
    category: 'Serif' | 'Sans-serif' | 'Display' | 'Monospace';
    fontFamily: string;
    description: string;
    // The Google Fonts css2 family fragment. Omitted for fonts that ship with
    // the OS — those need no network request at all.
    googleFamily?: string;
    isDefault?: boolean;
}

export const POPULAR_FONTS: AppFontOption[] = [
    {
        id: 'georgia',
        name: 'Georgia',
        category: 'Serif',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
        description: 'Classic, editorial, and highly readable serif font. Elegant and authoritative.',
        isDefault: true,
    },
    {
        id: 'inter',
        name: 'Inter',
        category: 'Sans-serif',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        description: 'Modern, clean, ultra-legible UI font used by top digital applications.',
        googleFamily: 'Inter:wght@300;400;600;700;900',
    },
    {
        id: 'roboto',
        name: 'Roboto',
        category: 'Sans-serif',
        fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
        description: 'Google’s iconic neo-grotesque sans-serif with friendly, open curves.',
        googleFamily: 'Roboto:wght@400;500;700;900',
    },
    {
        id: 'poppins',
        name: 'Poppins',
        category: 'Sans-serif',
        fontFamily: "'Poppins', sans-serif",
        description: 'Geometric sans-serif with minimalist aesthetics and sleek character curves.',
        googleFamily: 'Poppins:wght@300;400;600;700;900',
    },
    {
        id: 'playfair',
        name: 'Playfair Display',
        category: 'Serif',
        fontFamily: "'Playfair Display', Georgia, serif",
        description: 'High-contrast luxury serif typeface designed for headline elegance.',
        googleFamily: 'Playfair+Display:ital,wght@0,400;0,700;0,900;1,400',
    },
    {
        id: 'montserrat',
        name: 'Montserrat',
        category: 'Sans-serif',
        fontFamily: "'Montserrat', sans-serif",
        description: 'Bold geometric typography inspired by urban poster art and modern design.',
        googleFamily: 'Montserrat:wght@400;600;700;900',
    },
    {
        id: 'cinzel',
        name: 'Cinzel',
        category: 'Display',
        fontFamily: "'Cinzel', Georgia, serif",
        description: 'Regal, classical roman display typeface built for prestige and sports glory.',
        googleFamily: 'Cinzel:wght@400;700;900',
    },
    {
        id: 'oswald',
        name: 'Oswald',
        category: 'Display',
        fontFamily: "'Oswald', sans-serif",
        description: 'Condensed, athletic sans-serif optimized for impactful headlines and sports.',
        googleFamily: 'Oswald:wght@400;600;700',
    },
    {
        id: 'outfit',
        name: 'Outfit',
        category: 'Sans-serif',
        fontFamily: "'Outfit', sans-serif",
        description: 'Futuristic geometric font with sharp precision and modern brand identity.',
        googleFamily: 'Outfit:wght@400;600;700;900',
    },
    {
        id: 'courier-prime',
        name: 'Courier Prime',
        category: 'Monospace',
        fontFamily: "'Courier Prime', 'Courier New', monospace",
        description: 'Refined monospaced typewriter font with retro charm and strict alignment.',
        googleFamily: 'Courier+Prime:ital,wght@0,400;0,700;1,400',
    },
];

const DEFAULT_FONT = POPULAR_FONTS[0]; // Georgia

interface FontContextType {
    activeFont: AppFontOption;
    availableFonts: AppFontOption[];
    /** Persists the choice for every user. Admin only; rejects on failure. */
    setFont: (fontId: string) => Promise<void>;
    resetToDefault: () => Promise<void>;
    isSaving: boolean;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

// Only a paint cache, so a returning visitor doesn't flash Georgia before the
// server responds. The server is always the source of truth.
const CACHE_KEY = 'sffl_app_font_id';

const findFont = (fontId: string | null): AppFontOption | undefined =>
    fontId ? POPULAR_FONTS.find(f => f.id === fontId) : undefined;

// Web fonts are fetched only when actually selected — the default is a local
// serif, so the overwhelming majority of visitors download no font at all.
const loadWebFont = (font: AppFontOption) => {
    if (typeof document === 'undefined' || !font.googleFamily) return;

    const linkId = `app-font-${font.id}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
    document.head.appendChild(link);
};

const applyFontToDocument = (font: AppFontOption) => {
    if (typeof document === 'undefined') return;
    loadWebFont(font);
    // index.css points both `body` and Tailwind's `--font-sans` at this
    // variable, so setting it here restyles the whole app.
    document.documentElement.style.setProperty('--app-font-family', font.fontFamily);
};

export const useFont = (): FontContextType => {
    const context = useContext(FontContext);
    if (!context) {
        throw new Error('useFont must be used within a FontProvider');
    }
    return context;
};

interface FontProviderProps {
    children: ReactNode;
}

export const FontProvider = ({ children }: FontProviderProps) => {
    const [activeFont, setActiveFont] = useState<AppFontOption>(() => {
        if (typeof window === 'undefined') return DEFAULT_FONT;
        return findFont(localStorage.getItem(CACHE_KEY)) || DEFAULT_FONT;
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        applyFontToDocument(activeFont);
    }, [activeFont]);

    // Pull the site-wide choice. A failure here is not worth surfacing — the
    // cached (or default) font is already on screen and perfectly usable.
    useEffect(() => {
        let cancelled = false;
        appSettingsApi.get()
            .then(({ app_font_id }) => {
                if (cancelled) return;
                // An id this build doesn't know about falls back to the default
                // rather than leaving the app unstyled.
                const font = findFont(app_font_id) || DEFAULT_FONT;
                setActiveFont(font);
                localStorage.setItem(CACHE_KEY, font.id);
            })
            .catch(() => { /* keep the cached font */ });
        return () => { cancelled = true; };
    }, []);

    const setFont = async (fontId: string) => {
        const selected = findFont(fontId);
        if (!selected) throw new Error('Unknown font');

        setIsSaving(true);
        try {
            await appSettingsApi.setFont(selected.id);
            setActiveFont(selected);
            localStorage.setItem(CACHE_KEY, selected.id);
        } finally {
            setIsSaving(false);
        }
    };

    const resetToDefault = () => setFont(DEFAULT_FONT.id);

    return (
        <FontContext.Provider value={{ activeFont, availableFonts: POPULAR_FONTS, setFont, resetToDefault, isSaving }}>
            {children}
        </FontContext.Provider>
    );
};
