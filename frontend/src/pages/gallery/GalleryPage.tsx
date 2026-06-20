import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGallery, getCompetitions, getMatches, sortCompetitionsBySeason, type Competition } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Spinner } from '../../components/ui';
import { Pagination } from '../../components/ui/Pagination';

const ALL = 'ALL';

export const GalleryPage = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const LIMIT = 10;

    const { data: competitionsData, isLoading: loadingComps } = useQuery({
        queryKey: ['publicCompetitions'],
        queryFn: () => getCompetitions(1, 100),
    });
    const competitions: Competition[] = sortCompetitionsBySeason(
        (competitionsData?.data || []).filter(c => c.status !== 'inactive')
    );
    const leagueComps = competitions.filter(c => c.format !== 'KNOCKOUT');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
    
    // Find linked playoff for selected comp
    const linkedPlayoff = selectedComp?.playoff_competition_id
        ? competitions.find(c => c.id === selectedComp.playoff_competition_id)
        : null;

    // Reverse: if currently on a KNOCKOUT, find its parent league
    const parentLeague = !linkedPlayoff
        ? competitions.find(c => c.playoff_competition_id === selectedCompetitionId)
        : null;

    const dropdownComps = leagueComps.slice();
    if (selectedComp && selectedComp.format === 'KNOCKOUT') {
        if (!dropdownComps.some(c => c.id === selectedComp.id)) {
            dropdownComps.push(selectedComp);
        }
    }

    // Default to the competition of the most recent match so the gallery lands
    // on the currently-active stage instead of just the newest competition row.
    const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
        queryKey: ['publicLatestMatchForDefault'],
        queryFn: () => getMatches(undefined, 1, 1),
        staleTime: 60_000,
    });
    const latestMatchCompetitionId = latestMatchPage?.data?.[0]?.competition?.id;

    useEffect(() => {
        if (selectedCompetitionId || competitions.length === 0) return;
        if (!latestMatchFetched) return;
        if (latestMatchCompetitionId && competitions.some(c => c.id === latestMatchCompetitionId)) {
            setSelectedCompetitionId(latestMatchCompetitionId);
        } else {
            setSelectedCompetitionId(leagueComps[0]?.id || competitions[0]?.id);
        }
    }, [competitions, selectedCompetitionId, latestMatchFetched, latestMatchCompetitionId]);

    const competitionFilter = selectedCompetitionId === ALL ? undefined : selectedCompetitionId;

    const { data: galleryData, isLoading: loading } = useQuery({
        queryKey: ['publicGallery', currentPage, selectedCompetitionId],
        queryFn: () => getGallery(currentPage, LIMIT, competitionFilter),
        enabled: !!selectedCompetitionId,
    });

    const gallery = galleryData?.data || [];
    const totalPages = galleryData?.total_pages || 1;

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const handleCompetitionChange = (value: string) => {
        setSelectedCompetitionId(value);
        setCurrentPage(1);
    };

    const ensureAbsoluteUrl = (url: string) => {
        if (!url) return '#';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };

    // Only the initial competitions fetch blocks the page. Changing the
    // competition filter spins the gallery area in place (below) instead.
    if (loadingComps) {
        return <Loader />;
    }

    return (
        <div className="space-y-4 md:space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic">GALLERY</h1>
                    <p className="text-gray-300 mt-1 text-sm md:text-lg">Game day memories</p>
                </div>

                {competitions.length > 0 && (
                    <div className="mt-4 md:mt-0 flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1 min-w-[260px]">
                            <label className="block text-xs uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                            <div className="relative">
                                <select
                                    value={selectedCompetitionId}
                                    onChange={(e) => handleCompetitionChange(e.target.value)}
                                    className="w-full appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-base md:text-lg cursor-pointer hover:bg-white/20 transition-colors"
                                >
                                    {dropdownComps.map((c) => (
                                        <option key={c.id} value={c.id} className="text-black bg-white">
                                            {c.name} {c.status && !['active', 'completed'].includes(c.status) ? `[${c.status.toUpperCase()}]` : ''}
                                        </option>
                                    ))}
                                    <option value={ALL} className="text-black bg-white">All competitions</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        {(linkedPlayoff || parentLeague) && (
                            <button
                                onClick={() => handleCompetitionChange(linkedPlayoff ? linkedPlayoff.id : parentLeague!.id)}
                                className="px-5 py-3 h-[52px] md:h-[50px] bg-sffl-red text-white font-bold rounded-xl shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap text-base"
                            >
                                {linkedPlayoff ? (
                                    <>
                                        <span>🏆</span> Switch to Playoffs
                                    </>
                                ) : (
                                    <>
                                        <span>←</span> Back to Season
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Relive the excitement of SFFL game days! Browse through our collection of photos
                    featuring players in action and fans bringing the energy. All photos are hosted on
                    Google Drive for easy access and sharing.
                </p>
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                    <Spinner label="Loading gallery…" className="py-16" />
                </div>
            ) : gallery.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-12 rounded-xl text-center">
                    <div className="text-4xl mb-3">📸</div>
                    <p className="text-gray-500 text-lg font-semibold">No gallery entries yet for this competition.</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-sffl-navy text-white">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold uppercase tracking-wide">Game Week</th>
                                        <th className="px-6 py-4 text-left font-bold uppercase tracking-wide">Date</th>
                                        {selectedCompetitionId === ALL && (
                                            <th className="px-6 py-4 text-left font-bold uppercase tracking-wide">Competition</th>
                                        )}
                                        <th className="px-6 py-4 text-center font-bold uppercase tracking-wide">Players</th>
                                        <th className="px-6 py-4 text-center font-bold uppercase tracking-wide">Fans Zone</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gallery.map((entry, index) => (
                                        <tr
                                            key={entry.id}
                                            className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'} hover:bg-gray-100 dark:hover:bg-gray-600 transition duration-150`}
                                        >
                                            <td className="px-6 py-4 font-bold text-sffl-navy dark:text-white">
                                                {entry.game_week}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                                {entry.date}
                                            </td>
                                            {selectedCompetitionId === ALL && (
                                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                                    {entry.competition?.name || <span className="text-gray-400 italic">—</span>}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-center">
                                                <a
                                                    href={ensureAbsoluteUrl(entry.players_photo_url)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                                >
                                                    <span className="text-lg">🏈</span>
                                                    <span className="text-sm">Players</span>
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <a
                                                    href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                                >
                                                    <span className="text-lg">⚡</span>
                                                    <span className="text-sm">Fans</span>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden grid grid-cols-2 gap-2">
                        {gallery.map((entry) => (
                            <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <div>
                                    <div className="text-[10px] text-sffl-red font-black uppercase tracking-widest">{entry.date}</div>
                                    <div className="text-sm font-black text-sffl-navy dark:text-white truncate">{entry.game_week}</div>
                                    {selectedCompetitionId === ALL && entry.competition?.name && (
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{entry.competition.name}</div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 mt-auto">
                                    <a
                                        href={ensureAbsoluteUrl(entry.players_photo_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 py-2 rounded-lg text-[10px] font-bold text-sffl-navy dark:text-white"
                                    >
                                        <span>🏈</span> Players
                                    </a>
                                    <a
                                        href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 py-2 rounded-lg text-[10px] font-bold text-sffl-navy dark:text-white"
                                    >
                                        <span>⚡</span> Fans
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}

            {/* Info Box */}
            <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-sffl-red p-6 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Note:</strong> Photos are stored in Google Drive. Click the buttons to access
                    each folder. You can download, share, and tag yourself in the photos!
                </p>
            </div>
        </div>
    );
};
