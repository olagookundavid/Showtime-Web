import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowRightStartOnRectangleIcon,
  EyeIcon,
  LinkIcon,
  LinkSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { Button, Checkbox, ConfirmDialog, ConfirmSummary, DashboardPageHeader, DataTable, RowActions, Select, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaPlayer } from '../../../types';
import { EmptyState, Panel, StatusBadge } from '../../components';
import { PLATFORMS, errorMessage } from '../../utils';
import { PlayerFormModal, PlayerLinkModal, PlayerRegisterModal } from './PlayerForm';
import { useClubOptions } from './PlayerFormHelpers';

const NO_ROWS: ArenaPlayer[] = [];
const PAGE_SIZE = 25;

type PendingAction = { kind: 'release' | 'unlink' | 'delete'; player: ArenaPlayer };
type Dialog = { kind: 'form'; player?: ArenaPlayer } | { kind: 'link' | 'register'; player: ArenaPlayer };

export const ArenaAdminPlayers = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clubs = useClubOptions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [clubId, setClubId] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const filtered = !!search || !!clubId || freeOnly;

  // Ask for one row more than a page, so we know whether there is a next page.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['arena', 'admin', 'players', { page, search, clubId, freeOnly }],
    queryFn: () => arenaApi.adminPlayers({ q: search, club_id: freeOnly ? undefined : clubId, free: freeOnly, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });
  const rows = useMemo(() => (data ?? NO_ROWS).slice(0, PAGE_SIZE), [data]);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;

  const run = useMutation({
    mutationFn: async ({ kind, player }: PendingAction): Promise<void> => {
      if (kind === 'release') await arenaApi.releasePlayer(player.id);
      else if (kind === 'unlink') await arenaApi.linkPlayer(player.id, '');
      else await arenaApi.deletePlayer(player.id);
    },
    onSuccess: (_r, { kind, player }) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(
        kind === 'release' ? `${player.gamertag} released. They are now a free agent.` : kind === 'unlink' ? `${player.gamertag} is no longer linked to an account.` : `${player.gamertag} deleted.`,
      );
      setPending(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setPending(null);
    },
  });

  const columns = useMemo<Column<ArenaPlayer>[]>(
    () => [
      {
        header: 'Player',
        accessor: 'gamertag',
        sortable: true,
        cell: (p) => (
          <Link to={`/players/${p.id}`} className="flex min-h-11 items-center font-bold text-sffl-navy hover:underline dark:text-white">
            <span className="max-w-56 truncate">{p.gamertag}</span>
          </Link>
        ),
      },
      { header: 'EA ID', cell: (p) => p.ea_id || '—' },
      { header: 'Platform', cell: (p) => PLATFORMS.find((x) => x.value === p.platform)?.label ?? p.platform },
      { header: 'Position', accessor: 'primary_position', sortable: true },
      {
        header: 'Club',
        sortValue: (p) => p.club_name ?? '',
        sortable: true,
        cell: (p) =>
          p.club_id ? (
            <span className="block max-w-56 truncate">
              <Link to={`/admin/clubs/${p.club_id}`} className="font-semibold hover:underline">
                {p.club_name}
              </Link>
              {p.shirt_number ? <span className="text-gray-500 dark:text-gray-400"> &middot; #{p.shirt_number}</span> : null}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Free agent</span>
          ),
      },
      {
        header: 'Account',
        sortValue: (p) => (p.user_id ? 1 : 0),
        sortable: true,
        cell: (p) => <StatusBadge tone={p.user_id ? 'success' : 'neutral'}>{p.user_id ? 'Linked' : 'Not linked'}</StatusBadge>,
      },
      {
        header: 'Actions',
        align: 'right',
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.gamertag}`}
            actions={[
              { label: 'Open profile', icon: EyeIcon, onSelect: () => navigate(`/players/${p.id}`) },
              { label: 'Edit details', icon: PencilSquareIcon, onSelect: () => setDialog({ kind: 'form', player: p }) },
              p.user_id
                ? { label: 'Unlink account', icon: LinkSlashIcon, onSelect: () => setPending({ kind: 'unlink', player: p }) }
                : { label: 'Link account', icon: LinkIcon, onSelect: () => setDialog({ kind: 'link', player: p }) },
              p.club_id
                ? { label: 'Release from club', icon: ArrowRightStartOnRectangleIcon, onSelect: () => setPending({ kind: 'release', player: p }), hint: 'They become a free agent' }
                : { label: 'Register to club', icon: UserPlusIcon, onSelect: () => setDialog({ kind: 'register', player: p }) },
              { label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPending({ kind: 'delete', player: p }), hint: 'Not possible once they have stats or a signed contract' },
            ]}
          />
        ),
      },
    ],
    [navigate],
  );

  const text = pending && {
    release: {
      title: 'Release this player?',
      description: 'They leave their club and become a free agent. They are taken off any team sheets that haven’t been played.',
      confirmLabel: 'Release player',
      tone: 'warning' as const,
      icon: ArrowRightStartOnRectangleIcon,
    },
    unlink: {
      title: 'Unlink this account?',
      description: 'The person will no longer see this player as theirs or be able to sign contracts for them.',
      confirmLabel: 'Unlink account',
      tone: 'warning' as const,
      icon: LinkSlashIcon,
    },
    delete: {
      title: 'Delete this player?',
      description: 'This cannot be undone. Arena refuses it for a player who has recorded stats or a signed contract.',
      confirmLabel: 'Delete player',
      tone: 'danger' as const,
      icon: TrashIcon,
    },
  }[pending.kind];

  const toolbar = (
    <>
      <Select shape="square"
        aria-label="Filter by club"
        value={freeOnly ? '' : clubId}
        onChange={(e) => {
          setClubId(e.target.value);
          setPage(1);
        }}
        disabled={freeOnly}
        className="w-full sm:w-48"
      >
        <option value="">All clubs</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Checkbox
        label="Free agents only"
        checked={freeOnly}
        onChange={(e) => {
          setFreeOnly(e.target.checked);
          setPage(1);
        }}
      />
    </>
  );

  const addButton = (
    <Button shape="square" icon={PlusIcon} onClick={() => setDialog({ kind: 'form' })}>
      Add player
    </Button>
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Players" subtitle="Everyone who plays in Arena: their details, club and linked account." actions={addButton} />

      {!isLoading && !filtered && rows.length === 0 ? (
        <Panel title="No players yet">
          <EmptyState
            icon={UserGroupIcon}
            title="Add your first player"
            description="Players can also sign up themselves from their own Arena profile. Add one here to put them on a club straight away."
            action={addButton}
          />
        </Panel>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          loading={isLoading || (isFetching && !data)}
          getRowId={(p) => p.id}
          searchPlaceholder="Search by gamertag or EA ID"
          onSearchSubmit={(term) => {
            setSearch(term.trim());
            setPage(1);
          }}
          serverPage={page}
          totalServerPages={hasMore ? page + 1 : page}
          onPageChange={setPage}
          headerActions={toolbar}
          emptyMessage={filtered ? 'No players match. Clear the search or a filter to see more.' : 'No players found.'}
        />
      )}

      {dialog?.kind === 'form' && <PlayerFormModal player={dialog.player} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'link' && <PlayerLinkModal player={dialog.player} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'register' && <PlayerRegisterModal player={dialog.player} onClose={() => setDialog(null)} />}

      <ConfirmDialog
        open={!!pending && !!text}
        title={text?.title ?? ''}
        description={text?.description}
        confirmLabel={text?.confirmLabel ?? 'Confirm'}
        tone={text?.tone}
        icon={text?.icon}
        pending={run.isPending}
        body={pending && <ConfirmSummary rows={[['Player', pending.player.gamertag], ['Club', pending.player.club_name ?? 'Free agent']]} />}
        onConfirm={() => pending && run.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
