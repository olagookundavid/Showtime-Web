import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fantasyApi, type Leaderboard, type LeaderboardEntry } from '../services/api';

/** Managers shown per page in the windowed part of the table. */
export const LEADERBOARD_LIMIT = 20;

/** Scope value meaning "every manager in the season" rather than one league. */
export const OVERALL = 'overall';

const EMPTY_BOARD: Leaderboard = { data: [], total: 0, total_pages: 0, my_rank: 0 };

/** Nothing off the wire is trusted to be a finite number. */
export const num = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Medal colouring for the first three places; everyone else is neutral. */
export const rankBadgeClass = (rank: number): string =>
    rank === 1
        ? 'bg-amber-400 text-gray-900 shadow-md ring-2 ring-amber-400/50'
        : rank === 2
        ? 'bg-gray-300 text-gray-800'
        : rank === 3
        ? 'bg-amber-700 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';

interface Options {
    /** Needed for the Overall table; a league scope doesn't use it. */
    seasonId?: string;
    /** OVERALL, or a league id. */
    scope: string;
    /** Optional gameweek filter, passed straight through to the API. */
    gameweekId?: string;
    /** Distinguishes this table's cache entries from another on the same page. */
    queryPrefix: string;
}

/**
 * The standings table behind both the dashboard panel and the full leaderboard
 * page. It owns only the data and the paging arithmetic — each caller renders
 * its own markup, since one is a compact card and the other a wide table.
 *
 * Two things make it behave the way a league table should with thousands of
 * managers:
 *
 *   - The top three are fetched separately so the podium stays pinned no matter
 *     which page is being browsed. That query also carries `my_rank` and the
 *     row count.
 *   - The window opens on the page the viewer is actually on, not page 1, which
 *     tells a mid-table manager nothing. The page is *derived* from `my_rank`
 *     rather than pushed into state by an effect, so there is no flash of page
 *     1 and no cascading render.
 */
export function useFantasyLeaderboard({ seasonId, scope, gameweekId, queryPrefix }: Options) {
    // null means "wherever the viewer is"; a number is a page they chose.
    const [pageOverride, setPageOverride] = useState<number | null>(null);

    const scopeReady = scope === OVERALL ? !!seasonId : !!scope;

    const fetchBoard = (targetPage: number, limit: number): Promise<Leaderboard> => {
        const params = { gameweek_id: gameweekId || undefined, page: targetPage, limit };
        if (scope === OVERALL) {
            if (!seasonId) return Promise.resolve(EMPTY_BOARD);
            return fantasyApi.getOverallLeaderboard(seasonId, params);
        }
        return fantasyApi.getLeaderboard(scope, params);
    };

    // Resolves first: the window's opening page depends on this query's my_rank.
    const topQuery = useQuery({
        queryKey: [`${queryPrefix}Top`, scope, seasonId, gameweekId],
        queryFn: () => fetchBoard(1, 3),
        enabled: scopeReady,
    });
    const topBoard = topQuery.data;

    const knownTotal = num(topBoard?.total);
    const pagesFromTotal = Math.max(1, Math.ceil(knownTotal / LEADERBOARD_LIMIT) || 1);
    const rankForPaging = topQuery.isFetched ? num(topBoard?.my_rank) : 0;
    // Clamped so a rank running ahead of the data never lands past the end.
    const myPage =
        rankForPaging > 0
            ? Math.min(Math.max(1, Math.ceil(rankForPaging / LEADERBOARD_LIMIT)), pagesFromTotal)
            : 1;
    const page = pageOverride ?? myPage;

    const { data: board, isLoading: boardLoading } = useQuery({
        queryKey: [queryPrefix, scope, seasonId, gameweekId, page],
        queryFn: () => fetchBoard(page, LEADERBOARD_LIMIT),
        enabled: scopeReady && topQuery.isFetched,
    });

    const totalPages = Math.max(1, num(board?.total_pages) || pagesFromTotal);
    const total = num(board?.total) || knownTotal;
    const safePage = Math.min(Math.max(1, page), totalPages);
    const myRank = rankForPaging || num(board?.my_rank);

    const topThree: LeaderboardEntry[] = useMemo(
        () => (topBoard?.data ?? []).filter(Boolean).slice(0, 3),
        [topBoard]
    );

    // The podium above owns these rows — never print a manager twice.
    const windowRows: LeaderboardEntry[] = useMemo(() => {
        const pinned = new Set(topThree.map((e) => e?.team_id).filter(Boolean));
        return (board?.data ?? []).filter(Boolean).filter((e) => !(e?.team_id && pinned.has(e.team_id)));
    }, [board, topThree]);

    const rowCount = (board?.data ?? []).filter(Boolean).length;
    const isLoading = topQuery.isLoading || boardLoading;

    return {
        isLoading,
        /** True only once we know the table really is empty, not merely loading. */
        isEmpty: !isLoading && total === 0 && rowCount === 0 && topThree.length === 0,

        topThree,
        windowRows,
        total,
        totalPages,
        page: safePage,
        myRank,
        /** Hidden when the viewer has no position, or is already on their page. */
        canJumpToMe: myRank > 0 && safePage !== myPage,
        /** True when everyone in the table is already on the podium. */
        allOnPodium: total <= topThree.length,

        goToPage: (p: number) => setPageOverride(Math.min(Math.max(1, p), totalPages)),
        /** Back to the viewer's own page. */
        jumpToMe: () => setPageOverride(null),
        /** Changing scope or filter starts again from the viewer's page. */
        resetPaging: () => setPageOverride(null),

        /** Rank to show when an entry arrives without one. */
        fallbackRankAt: (indexOnPage: number) => (safePage - 1) * LEADERBOARD_LIMIT + indexOnPage + 1,
    };
}
