import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGallery, getCompetitions, getMatches, sortCompetitionsBySeason, dropdownCompetitionsFor, type Competition, type Gallery } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { Spinner } from '../../components/ui';
import { DataTable } from '../../components/ui/DataTable';
import { FootballIcon } from '../../components/icons/FootballIcon';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { Pagination } from '../../components/ui/Pagination';
import { Field, Select } from '../../components/ui';
import { SeasonStageTabs } from '../../components/common/SeasonStageTabs';

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
    const leagueComps = competitions.filter(c => (c.format || 'SEASON') === 'SEASON');
    const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

    const dropdownComps = dropdownCompetitionsFor(competitions, selectedComp);

    // Default to the competition of the most recent match so the gallery lands
    // on the currently-active stage instead of just the newest competition row.
    const { data: latestMatchPage, isFetched: latestMatchFetched } = useQuery({
        queryKey: ['publicLatestMatchForDefault'],
        queryFn: () => getMatches(undefined, 1, 1, 'FINISHED'),
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
                    <div className="mt-4 md:mt-0 flex flex-col gap-2 md:w-[280px]">
                        <div className="min-w-[260px]">
                            <Field label="Competition" tone="dark">
                                <Select
                                    tone="dark"
                                    value={selectedCompetitionId}
                                    onChange={(e) => handleCompetitionChange(e.target.value)}
                                >
                                    {dropdownComps.map((c) => (
                                        <option key={c.id} value={c.id} className="text-black bg-white">
                                            {c.name} {c.status && !['active', 'completed'].includes(c.status) ? `[${c.status.toUpperCase()}]` : ''}
                                        </option>
                                    ))}
                                    <option value={ALL} className="text-black bg-white">All competitions</option>
                                </Select>
                            </Field>
                        </div>
                    </div>
                )}
            </div>

            {/* Season | Playoffs toggle for the selected competition */}
            <SeasonStageTabs competitions={competitions} currentId={selectedCompetitionId} onChange={handleCompetitionChange} />

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
                        <DataTable
                            compact
                            searchable={false}
                            paginated={false}
                            getRowId={(entry) => entry.id}
                            data={gallery}
                            rowClassName={(entry) =>
                                `${gallery.indexOf(entry) % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'} hover:bg-gray-100 dark:hover:bg-gray-600`
                            }
                            columns={[
                                {
                                    header: 'Game Week',
                                    className: 'px-6 py-4 font-bold text-sffl-navy dark:text-white',
                                    cell: (entry) => entry.game_week,
                                },
                                {
                                    header: 'Date',
                                    className: 'px-6 py-4 text-gray-700 dark:text-gray-300',
                                    cell: (entry) => entry.date,
                                },
                                ...(selectedCompetitionId === ALL
                                    ? [
                                          {
                                              header: 'Competition',
                                              className: 'px-6 py-4 text-gray-700 dark:text-gray-300',
                                              cell: (entry: Gallery) =>
                                                  entry.competition?.name || <span className="text-gray-400 italic">—</span>,
                                          },
                                      ]
                                    : []),
                                {
                                    header: 'Players',
                                    align: 'center',
                                    className: 'px-6 py-4',
                                    cell: (entry) => (
                                        <a
                                            href={ensureAbsoluteUrl(entry.players_photo_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                        >
                                            <FootballIcon className="w-5 h-5" aria-hidden="true" />
                                            <span className="text-sm">Players</span>
                                        </a>
                                    ),
                                },
                                {
                                    header: 'Fans Zone',
                                    align: 'center',
                                    className: 'px-6 py-4',
                                    cell: (entry) => (
                                        <a
                                            href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                        >
                                            <UserGroupIcon className="w-5 h-5" aria-hidden="true" />
                                            <span className="text-sm">Fans</span>
                                        </a>
                                    ),
                                },
                            ]}
                        />
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
                                        <FootballIcon className="w-4 h-4" aria-hidden="true" /> Players
                                    </a>
                                    <a
                                        href={ensureAbsoluteUrl(entry.fans_photo_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 py-2 rounded-lg text-[10px] font-bold text-sffl-navy dark:text-white"
                                    >
                                        <UserGroupIcon className="w-4 h-4" aria-hidden="true" /> Fans
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
