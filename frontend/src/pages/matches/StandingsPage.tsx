import { useEffect, useState } from 'react';
import { getCompetitions, getStandings, type Competition, type Standing } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { StandingsTable } from '../../components/matches/StandingsTable';

export const StandingsPage = () => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
    const [standings, setStandings] = useState<Standing[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);

    // Fetch Competitions on Mount
    useEffect(() => {
        const fetchCompetitions = async () => {
            try {
                const data = await getCompetitions();
                setCompetitions(data);
                if (data.length > 0) {
                    setSelectedCompetitionId(data[0].id);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch competitions:", error);
                setLoading(false);
            }
        };
        fetchCompetitions();
    }, []);

    // Fetch Standings when Competition Changes
    useEffect(() => {
        if (!selectedCompetitionId) return;

        const fetchStandings = async () => {
            setDataLoading(true);
            try {
                const data = await getStandings(selectedCompetitionId);
                setStandings(data || []);
            } catch (error) {
                console.error("Failed to fetch standings:", error);
            } finally {
                setLoading(false);
                setDataLoading(false);
            }
        };

        fetchStandings();
    }, [selectedCompetitionId]);

    if (loading && competitions.length === 0) return <Loader />;

    // Find selected competition name
    const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);

    return (
        <div className="max-w-5xl mx-auto space-y-10 min-h-screen p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">STANDINGS</h1>
                    <p className="text-gray-300 mt-2 text-lg">League tables & team rankings</p>
                </div>

                {/* Competition Selector */}
                {competitions.length > 0 && (
                    <div className="mt-4 md:mt-0">
                        <label className="block text-xs uppercase text-gray-400 font-bold mb-1 tracking-wider">Competition</label>
                        <div className="relative">
                            <select
                                value={selectedCompetitionId}
                                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                className="appearance-none bg-white/10 border border-white/20 text-white py-3 px-6 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-sffl-red font-bold text-lg min-w-[260px] cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                {competitions.map((c) => (
                                    <option key={c.id} value={c.id} className="text-black bg-white">
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Indicator */}
            {dataLoading && (
                <div className="flex justify-center items-center gap-2 text-gray-500">
                    <div className="w-5 h-5 border-2 border-sffl-red border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">Loading standings...</span>
                </div>
            )}

            {/* Standings Table */}
            {!dataLoading && standings.length > 0 ? (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="text-yellow-500 text-2xl">🏆</span>
                        <h2 className="text-2xl font-bold text-sffl-navy dark:text-white">
                            {selectedCompetition?.name || 'League'} Table
                        </h2>
                    </div>
                    <StandingsTable standings={standings} />
                </div>
            ) : !dataLoading ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-16 rounded-xl text-center">
                    <div className="text-5xl mb-4">🏆</div>
                    <p className="text-gray-500 text-lg font-semibold">No standings available for this competition yet.</p>
                    <p className="text-gray-400 mt-2">Check back once matches have been played.</p>
                </div>
            ) : null}
        </div>
    );
};
