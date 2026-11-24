import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowTopRightOnSquareIcon, PencilSquareIcon, PlusIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { Button, DashboardPageHeader, DataTable, RowActions, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaSeason } from '../../../types';
import { EmptyState, Panel, StatusBadge } from '../../components';
import { errorMessage } from '../../utils';
import { SeasonFormModal } from './SeasonFormModal';
import { SEASON_STATUS, seasonDates, seasonKeys } from './seasonHelpers';

const NO_SEASONS: ArenaSeason[] = [];

export const ArenaAdminSeasons = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ArenaSeason | null>(null);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: seasonKeys.all, queryFn: arenaApi.adminSeasons });
  const seasons = data ?? NO_SEASONS;
  const nextNumber = seasons.reduce((max, s) => Math.max(max, s.number), 0) + 1;

  const columns = useMemo<Column<ArenaSeason>[]>(
    () => [
      {
        header: 'Season',
        accessor: 'name',
        sortable: true,
        cell: (s) => (
          <Link to={`/admin/seasons/${s.id}`} className="font-bold text-sffl-red hover:underline dark:text-arena-lime">
            {s.name}
          </Link>
        ),
      },
      { header: 'Number', accessor: 'number', sortable: true, cell: (s) => <span className="tabular">{s.number}</span> },
      {
        header: 'Status',
        accessor: 'status',
        sortable: true,
        cell: (s) => <StatusBadge tone={SEASON_STATUS[s.status].tone}>{SEASON_STATUS[s.status].label}</StatusBadge>,
      },
      { header: 'Dates', sortValue: (s) => s.starts_on ?? '', sortable: true, cell: (s) => <span className="whitespace-nowrap">{seasonDates(s)}</span> },
      {
        header: 'Transfer window',
        accessor: 'transfer_window_open',
        cell: (s) => <StatusBadge tone={s.transfer_window_open ? 'success' : 'neutral'}>{s.transfer_window_open ? 'Open' : 'Closed'}</StatusBadge>,
      },
      {
        header: 'Actions',
        align: 'right',
        cell: (s) => (
          <RowActions
            label={`Actions for ${s.name}`}
            actions={[
              { label: 'Open', icon: ArrowTopRightOnSquareIcon, onSelect: () => navigate(`/admin/seasons/${s.id}`) },
              { label: 'Edit', icon: PencilSquareIcon, onSelect: () => setEditing(s) },
            ]}
          />
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title="Seasons"
        subtitle="Create a season, then open it to add divisions, put clubs in them and make the fixtures."
        actions={
          <Button icon={PlusIcon} onClick={() => setCreating(true)}>
            New season
          </Button>
        }
      />

      <Panel title="All seasons" flush>
        {error ? (
          <EmptyState
            icon={TrophyIcon}
            title="Seasons could not be loaded"
            description={errorMessage(error)}
            action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}
          />
        ) : !isLoading && seasons.length === 0 ? (
          <EmptyState
            icon={TrophyIcon}
            title="No seasons yet"
            description="A season holds your divisions, clubs and fixtures. Create the first one to get started."
            action={<Button icon={PlusIcon} onClick={() => setCreating(true)}>Create the first season</Button>}
          />
        ) : (
          <DataTable
            data={seasons}
            columns={columns}
            loading={isLoading}
            getRowId={(s) => s.id}
            searchable={false}
            paginated={false}
            emptyMessage="No seasons yet."
          />
        )}
      </Panel>

      {creating && (
        <SeasonFormModal
          suggestedNumber={nextNumber}
          onClose={() => setCreating(false)}
          onSaved={(s) => navigate(`/admin/seasons/${s.id}`)}
        />
      )}
      {editing && <SeasonFormModal season={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
