import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArchiveBoxArrowDownIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  DataTable,
  RowActions,
  Select,
  type Column,
} from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClub } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge } from '../../components';
import { useArenaScope } from '../../scope';
import { errorMessage } from '../../utils';
import { ClubFormModal } from './ClubForm';

const NO_ROWS: ArenaClub[] = [];

type PendingAction = { kind: 'archive' | 'restore' | 'delete'; club: ArenaClub };

export const ArenaAdminClubs = () => {
  const { divisions } = useArenaScope();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [divisionId, setDivisionId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [form, setForm] = useState<{ club?: ArenaClub } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const filtered = !!divisionId || showArchived || unassigned;

  const { data, isLoading } = useQuery({
    queryKey: ['arena', 'admin', 'clubs', { divisionId, showArchived, unassigned }],
    queryFn: () => arenaApi.adminClubs({ division_id: unassigned ? undefined : divisionId, archived: showArchived, unassigned }),
  });
  const clubs = data ?? NO_ROWS;

  const run = useMutation({
    mutationFn: async ({ kind, club }: PendingAction) => {
      if (kind === 'delete') return arenaApi.deleteClub(club.id);
      return arenaApi.archiveClub(club.id, kind === 'archive');
    },
    onSuccess: (_r, { kind, club }) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(kind === 'delete' ? `${club.name} deleted.` : kind === 'archive' ? `${club.name} archived.` : `${club.name} restored.`);
      setPending(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setPending(null);
    },
  });

  const columns = useMemo<Column<ArenaClub>[]>(
    () => [
      {
        header: 'Club',
        accessor: 'name',
        sortable: true,
        cell: (c) => (
          <Link to={`/admin/clubs/${c.id}`} className="flex min-h-11 min-w-0 items-center gap-3 font-bold text-sffl-navy hover:underline dark:text-white">
            <Crest club={c} size="md" />
            <span className="max-w-56 truncate">{c.name}</span>
          </Link>
        ),
      },
      { header: 'Code', accessor: 'short', sortable: true, cell: (c) => <span className="font-bold tracking-wide">{c.short}</span> },
      {
        header: 'Division',
        sortValue: (c) => c.division_name ?? '',
        sortable: true,
        cell: (c) => (c.division_name ? c.division_name : <span className="text-gray-500 dark:text-gray-400">Not in a division</span>),
      },
      {
        header: 'Manager',
        sortValue: (c) => c.manager_name ?? c.manager_email ?? '',
        sortable: true,
        cell: (c) =>
          c.manager_user_id ? (
            <span className="block max-w-56">
              <span className="block truncate font-semibold">{c.manager_name || c.manager_email}</span>
              {c.manager_name && c.manager_email && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{c.manager_email}</span>}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">No manager</span>
          ),
      },
      { header: 'Squad', accessor: 'squad_size', sortable: true, align: 'right', cell: (c) => <span className="tabular">{c.squad_size}</span> },
      {
        header: 'Status',
        accessor: 'status',
        cell: (c) => <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status === 'active' ? 'Active' : 'Archived'}</StatusBadge>,
      },
      {
        header: 'Actions',
        align: 'right',
        cell: (c) => (
          <RowActions
            label={`Actions for ${c.name}`}
            actions={[
              { label: 'Open club', icon: EyeIcon, onSelect: () => navigate(`/admin/clubs/${c.id}`) },
              { label: 'Edit details', icon: PencilSquareIcon, onSelect: () => setForm({ club: c }) },
              c.status === 'active'
                ? { label: 'Archive', icon: ArchiveBoxIcon, onSelect: () => setPending({ kind: 'archive', club: c }), hint: 'Hide it but keep its history' }
                : { label: 'Restore', icon: ArrowUturnLeftIcon, onSelect: () => setPending({ kind: 'restore', club: c }) },
              {
                label: 'Delete',
                icon: TrashIcon,
                danger: true,
                disabled: c.has_played || c.squad_size > 0,
                hint: c.has_played ? 'It has played, so archive it instead' : c.squad_size > 0 ? 'Release its players first' : undefined,
                onSelect: () => setPending({ kind: 'delete', club: c }),
              },
            ]}
          />
        ),
      },
    ],
    [navigate],
  );

  const dialog = pending && {
    archive: {
      title: 'Archive this club?',
      description: 'It disappears from the live competition but its results and history are kept. You can restore it any time.',
      confirmLabel: 'Archive club',
      tone: 'warning' as const,
      icon: ArchiveBoxArrowDownIcon,
    },
    restore: {
      title: 'Restore this club?',
      description: 'It will show up in the competition and can be put in a division again.',
      confirmLabel: 'Restore club',
      tone: 'success' as const,
      icon: ArrowUturnLeftIcon,
    },
    delete: {
      title: 'Delete this club?',
      description: 'This cannot be undone. Arena only allows it for a club with no fixtures and no players.',
      confirmLabel: 'Delete club',
      tone: 'danger' as const,
      icon: TrashIcon,
    },
  }[pending.kind];

  const toolbar = (
    <>
      <Select shape="square"
        aria-label="Filter by division"
        value={unassigned ? '' : divisionId}
        onChange={(e) => setDivisionId(e.target.value)}
        disabled={unassigned}
        className="w-full sm:w-48"
      >
        <option value="">All divisions</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Checkbox label="Not in a division" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />
      <Checkbox label="Show archived" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
    </>
  );

  const addButton = (
    <Button shape="square" icon={PlusIcon} onClick={() => setForm({})}>
      Register club
    </Button>
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Clubs" subtitle="Register the clubs in the tournament, choose their divisions and give each one a manager." actions={addButton} />

      {!isLoading && !filtered && clubs.length === 0 ? (
        <Panel title="No clubs yet">
          <EmptyState
            icon={ShieldCheckIcon}
            title="Register your first club"
            description="Clubs take part in a division's league. Register a club here, then add its players and give it a manager who will pick the team."
            action={addButton}
          />
        </Panel>
      ) : (
        <DataTable
          data={clubs}
          columns={columns}
          loading={isLoading}
          getRowId={(c) => c.id}
          searchPlaceholder="Search clubs by name or code"
          headerActions={toolbar}
          emptyMessage={filtered ? 'No clubs match these filters. Clear a filter to see more.' : 'No clubs found.'}
        />
      )}

      {form && <ClubFormModal club={form.club} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={!!pending && !!dialog}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        confirmLabel={dialog?.confirmLabel ?? 'Confirm'}
        tone={dialog?.tone}
        icon={dialog?.icon}
        pending={run.isPending}
        body={pending && <ConfirmSummary rows={[['Club', pending.club.name], ['Division', pending.club.division_name], ['Players', String(pending.club.squad_size)]]} />}
        onConfirm={() => pending && run.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
