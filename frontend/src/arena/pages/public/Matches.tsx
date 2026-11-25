import { useMemo, useState } from 'react';
import { FlagIcon } from '@heroicons/react/24/outline';
import { DashboardPageHeader, Tabs } from '../../../components';
import { DivisionGate, EmptyState, MatchRow, Panel } from '../../components';
import { useMatches } from '../../hooks';
import type { ArenaMatch } from '../../../types';
import { matchRound } from '../../utils';

type Filter = 'results' | 'upcoming' | 'all';

/** Group matches into one panel per round, in the order they were given. */
const byRound = (matches: ArenaMatch[]) => {
  const groups: { key: string; title: string; matches: ArenaMatch[] }[] = [];
  for (const m of matches) {
    const key = `${m.stage}-${m.matchweek}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: matchRound(m), matches: [] };
      groups.push(g);
    }
    g.matches.push(m);
  }
  return groups;
};

export const ArenaMatches = () => {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const query = useMatches(filter === 'all' ? undefined : filter);
  const groups = useMemo(() => byRound(query.data?.matches ?? []), [query.data]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Matches" subtitle="Every fixture and result. All times are in West Africa Time (WAT)." />
      <Tabs
        aria-label="Which matches to show"
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'results', label: 'Results' },
          { value: 'all', label: 'All matches' },
        ]}
      />
      <DivisionGate query={query}>
        {groups.length === 0 ? (
          <Panel title="Matches">
            <EmptyState
              icon={FlagIcon}
              title={filter === 'results' ? 'No results yet' : filter === 'upcoming' ? 'Nothing left to play' : 'No fixtures yet'}
              description={filter === 'results' ? 'Results appear here as soon as each match is confirmed.' : 'When fixtures are published they will show here.'}
            />
          </Panel>
        ) : (
          groups.map((g) => (
            <Panel key={g.key} title={g.title} flush>
              <p className="-mt-2 px-4 pb-2 text-xs text-gray-500 sm:px-5 dark:text-gray-400">{g.matches.length} {g.matches.length === 1 ? 'match' : 'matches'}</p>
              {g.matches.map((m) => (
                <MatchRow key={m.id} match={m} showRound={false} />
              ))}
            </Panel>
          ))
        )}
      </DivisionGate>
    </div>
  );
};
