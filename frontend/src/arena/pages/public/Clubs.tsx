import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, Field, Input } from '../../../components';
import { Crest, DivisionGate, EmptyState } from '../../components';
import { useDivisionClubs, useStandings } from '../../hooks';

/** Every club in the division as a card with its position and points. */
export const ArenaClubs = () => {
  const [search, setSearch] = useState('');
  const clubs = useDivisionClubs();
  const standings = useStandings();
  const rows = useMemo(() => new Map((standings.data?.rows ?? []).map((r) => [r.club.id, r])), [standings.data]);
  const shown = useMemo(() => (clubs.data ?? []).filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())), [clubs.data, search]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Clubs" subtitle="Every club in the division, with its squad, form and fixtures." />
      <Field label="Search clubs" htmlFor="club-search" className="max-w-md">
        <Input shape="square" id="club-search" icon={MagnifyingGlassIcon} placeholder="Club name" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <DivisionGate query={clubs}>
        {shown.length === 0 ? (
          <EmptyState icon={ShieldCheckIcon} title="No clubs found" description={search ? 'Try a different name.' : 'Clubs appear here once the organisers register them.'} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => {
              const row = rows.get(c.id);
              return (
                <li key={c.id}>
                  <Link
                    to={`/clubs/${c.slug}`}
                    className="block h-full border border-gray-200 bg-white p-4 transition-colors hover:border-sffl-red dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <Crest club={c} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-extrabold text-sffl-navy dark:text-white">{c.name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {c.division_name || 'No division'} · {c.squad_size} {c.squad_size === 1 ? 'player' : 'players'}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Position', row ? row.rank : '-'],
                        ['Points', row ? row.points : '-'],
                        ['Goals', row ? row.gf : '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-gray-50 p-2 dark:bg-white/5">
                          <dd className="tabular text-lg font-black text-sffl-navy dark:text-white">{value}</dd>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DivisionGate>
    </div>
  );
};
