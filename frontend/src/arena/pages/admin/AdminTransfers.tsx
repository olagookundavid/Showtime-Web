import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowsRightLeftIcon, DocumentTextIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { ButtonLink, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, Field, RowActions, Select, type Column } from '../../../components';
import { usePermissions } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaContract, ArenaContractStatus } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge, contractTone } from '../../components';
import { useArenaScope } from '../../useArenaScope';
import { CONTRACT_STATUS_LABEL, errorMessage, formatDateOnly, formatNaira, squadRoleLabel } from '../../utils';
import { TransferDetailModal } from './TransferDetailModal';

const NO_ROWS: ArenaContract[] = [];

type StatusFilter = ArenaContractStatus | 'open' | 'all';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open (waiting on someone)' },
  { value: 'all', label: 'All contracts' },
  { value: 'signed', label: CONTRACT_STATUS_LABEL.signed },
  { value: 'rejected', label: CONTRACT_STATUS_LABEL.rejected },
  { value: 'release_declined', label: CONTRACT_STATUS_LABEL.release_declined },
  { value: 'withdrawn', label: CONTRACT_STATUS_LABEL.withdrawn },
];

const isOpen = (k: ArenaContract) => k.status === 'awaiting_release' || k.status === 'awaiting_player';

export const ArenaAdminTransfers = () => {
  const { season } = useArenaScope();
  const { canView } = usePermissions();
  const qc = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('open');
  const [viewing, setViewing] = useState<ArenaContract | null>(null);
  const [closing, setClosing] = useState<ArenaContract | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['arena', 'admin', 'contracts', status],
    queryFn: () => arenaApi.adminContracts(status === 'all' ? undefined : status),
  });
  const contracts = data ?? NO_ROWS;

  const close = useMutation({
    mutationFn: (k: ArenaContract) => arenaApi.adminWithdrawContract(k.id),
    onSuccess: (_r, k) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`The offer to ${k.player_name} was closed.`);
      setClosing(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setClosing(null);
    },
  });

  const columns = useMemo<Column<ArenaContract>[]>(
    () => [
      {
        header: 'Player',
        accessor: 'player_name',
        sortable: true,
        cell: (k) => <span className="block min-h-11 max-w-56 truncate py-3 font-bold text-sffl-navy dark:text-white">{k.player_name}</span>,
      },
      {
        header: 'Offered by',
        accessor: 'club_name',
        sortable: true,
        cell: (k) => (
          <span className="flex min-w-0 items-center gap-2">
            <Crest club={{ name: k.club_name, short: k.club_short, color: k.club_color, crest_url: '' }} size="sm" />
            <span className="max-w-48 truncate">{k.club_name}</span>
          </span>
        ),
      },
      { header: 'From', sortValue: (k) => k.from_club_name ?? '', sortable: true, cell: (k) => k.from_club_name || <span className="text-gray-500 dark:text-gray-400">Free agent</span> },
      { header: 'Role', cell: (k) => squadRoleLabel(k.squad_role) },
      { header: 'Ends', accessor: 'end_date', sortable: true, cell: (k) => formatDateOnly(k.end_date) },
      { header: 'Fee (not charged)', accessor: 'fee_ngn', sortable: true, align: 'right', cell: (k) => <span className="tabular">{formatNaira(k.fee_ngn)}</span> },
      { header: 'Status', accessor: 'status', cell: (k) => <StatusBadge tone={contractTone(k.status)}>{CONTRACT_STATUS_LABEL[k.status]}</StatusBadge> },
      {
        header: 'Actions',
        align: 'right',
        cell: (k) => (
          <RowActions
            label={`Actions for ${k.player_name}'s contract`}
            actions={[
              { label: 'View details', icon: DocumentTextIcon, onSelect: () => setViewing(k) },
              {
                label: 'Close offer',
                icon: XCircleIcon,
                danger: true,
                disabled: !isOpen(k),
                hint: isOpen(k) ? 'Stops the offer; the player can no longer sign it' : 'Only open offers can be closed',
                onSelect: () => setClosing(k),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Transfers" subtitle="Every contract offered this season, and where each one stands. Fees are recorded only; nothing is charged." />

      <Panel title="Transfer window">
        {season ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                {season.name} <StatusBadge tone={season.transfer_window_open ? 'success' : 'neutral'}>{season.transfer_window_open ? 'Window open' : 'Window closed'}</StatusBadge>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {season.transfer_window_open ? 'Managers can make offers and players can sign them.' : 'Contracts can only be made or signed while the window is open.'}
              </p>
            </div>
            {canView('arena_seasons') && (
              <ButtonLink to={`/admin/seasons/${season.id}`} variant="secondary" icon={ArrowsRightLeftIcon}>
                {season.transfer_window_open ? 'Close the window' : 'Open the window'}
              </ButtonLink>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">There is no season yet, so there is no transfer window.</p>
        )}
        {season && !canView('arena_seasons') && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">The window is switched on the season's page, which needs Seasons access.</p>}
      </Panel>

      <div className="w-full sm:max-w-xs">
        <Field label="Show" htmlFor="transfers-status">
          <Select id="transfers-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!isLoading && contracts.length === 0 && status === 'all' ? (
        <Panel title="No contracts yet">
          <EmptyState
            icon={ArrowsRightLeftIcon}
            title="No offers have been made this season"
            description="Club managers make offers to players from their own Transfers page, while the transfer window is open. They will all appear here."
          />
        </Panel>
      ) : (
        <DataTable
          data={contracts}
          columns={columns}
          loading={isLoading}
          getRowId={(k) => k.id}
          searchPlaceholder="Search by player or club"
          emptyMessage={status === 'open' ? 'No offers are waiting on anyone right now.' : 'No contracts match this filter.'}
        />
      )}

      {viewing && <TransferDetailModal contract={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={!!closing}
        title="Close this offer?"
        description="The offer is withdrawn and the player can no longer sign it. The club can make a new offer while the window is open."
        confirmLabel="Close offer"
        tone="danger"
        icon={XCircleIcon}
        pending={close.isPending}
        body={
          closing && (
            <ConfirmSummary
              rows={[
                ['Player', closing.player_name],
                ['Offered by', closing.club_name],
                ['Status', CONTRACT_STATUS_LABEL[closing.status]],
                ['Fee', formatNaira(closing.fee_ngn)],
              ]}
            />
          )
        }
        onConfirm={() => closing && close.mutate(closing)}
        onCancel={() => setClosing(null)}
      />
    </div>
  );
};
