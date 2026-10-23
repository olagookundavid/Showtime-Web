/**
 * The categories a Fantasy article is filed under. Quick add on the Fantasy
 * Carousel admin page offers exactly these; the first is the default. Keep in
 * step with domain.FantasyNewsCategories in the backend.
 */
export const FANTASY_NEWS_CATEGORIES: string[] = ['Fantasy', 'Fantasy News'];

/** The most slides the Fantasy page carousel holds (domain.FantasyCarouselMax). */
export const FANTASY_CAROUSEL_MAX = 10;

/**
 * Every news category an article can be filed under. Both of the admin news
 * dropdowns (the list filter and the article form) read this one list, so a
 * category added here shows up in both.
 */
export const NEWS_CATEGORIES: string[] = [
    'General',
    'Match Report',
    'Transfer News',
    'Interview',
    'Analysis',
    "Commissioner's Note",
    'Community',
    ...FANTASY_NEWS_CATEGORIES,
];
