import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, type Match } from '../../services/api';
import { Loader } from '../../components/ui/Loader';
import { VideoCameraIcon, ArrowTopRightOnSquareIcon, ClipboardDocumentCheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

export function AdminBroadcastPicker() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'SCHEDULED' | 'FINISHED'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatches() {
      setLoading(true);
      try {
        const res = await getMatches(undefined, 1, 50);
        setMatches(res.data || []);
      } catch (err) {
        console.error('Error loading matches for broadcast:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, []);

  const filteredMatches = matches.filter((m) => {
    if (filter === 'ALL') return true;
    return m.status?.toUpperCase() === filter;
  });

  const copyOverlayUrl = (matchId: string) => {
    const url = `${window.location.origin}/broadcast/${matchId}/overlay`;
    navigator.clipboard.writeText(url);
    setCopiedId(matchId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Showtime Signature Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-sffl-navy text-white p-6 md:p-8 rounded-xl md:rounded-2xl shadow-xl gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter flex items-center gap-3">
            <VideoCameraIcon className="w-8 h-8 md:w-12 md:h-12 text-sffl-red" />
            BROADCAST STUDIO
          </h1>
          <p className="text-gray-300 mt-1 text-sm md:text-base">
            Select a live or scheduled match to launch on-air graphics control for vMix.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
        {(['ALL', 'LIVE', 'SCHEDULED', 'FINISHED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors ${
              filter === tab
                ? 'bg-sffl-red text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Match List */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader />
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500">
          No matches found for the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMatches.map((m) => {
            const isLive = m.status?.toUpperCase() === 'LIVE';
            const isFinished = m.status?.toUpperCase() === 'FINISHED';
            const homeName = m.home_team?.name || 'Home Team';
            const awayName = m.away_team?.name || 'Away Team';

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Status & Competition Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {m.competition?.name || 'Showtime League'} · {new Date(m.date).toLocaleDateString()}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase ${
                        isLive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : isFinished
                          ? 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  {/* Teams & Scores */}
                  <div className="flex items-center justify-between gap-4 my-2">
                    {/* Home Team */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {m.home_team?.logo ? (
                        <img src={m.home_team.logo} alt="" className="w-10 h-10 object-contain rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-400">
                          H
                        </div>
                      )}
                      <span className="font-black text-gray-900 dark:text-white truncate text-base md:text-lg">
                        {homeName}
                      </span>
                    </div>

                    {/* Score */}
                    <div className="text-center px-3 py-1 bg-gray-50 dark:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-600 font-black text-lg md:text-xl text-gray-900 dark:text-white">
                      {m.home_score ?? 0} – {m.away_score ?? 0}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-end gap-3 flex-1 min-w-0 text-right">
                      <span className="font-black text-gray-900 dark:text-white truncate text-base md:text-lg">
                        {awayName}
                      </span>
                      {m.away_team?.logo ? (
                        <img src={m.away_team.logo} alt="" className="w-10 h-10 object-contain rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center font-bold text-gray-400">
                          A
                        </div>
                      )}
                    </div>
                  </div>

                  {m.venue && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      📍 {m.venue}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                  <button
                    onClick={() => copyOverlayUrl(m.id)}
                    className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-sffl-red dark:hover:text-sffl-red flex items-center gap-1.5 transition-colors"
                    title="Copy transparent vMix overlay browser URL"
                  >
                    {copiedId === m.id ? (
                      <>
                        <ClipboardDocumentCheckIcon className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied vMix URL!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardDocumentIcon className="w-4 h-4" />
                        <span>Copy vMix URL</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/broadcast/${m.id}/overlay`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Open transparent overlay in new tab"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>

                    <Link
                      to={`/admin/broadcast/${m.id}`}
                      className="bg-sffl-red hover:bg-[#A52323] text-white font-bold px-4 py-2 rounded-xl text-xs md:text-sm shadow-md transition-all flex items-center gap-1.5"
                    >
                      <VideoCameraIcon className="w-4 h-4" />
                      Launch Studio
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminBroadcastPicker;
