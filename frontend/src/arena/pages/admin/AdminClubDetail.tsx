import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRightStartOnRectangleIcon, EyeIcon, PencilSquareIcon, PlusIcon, UserGroupIcon, UserMinusIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  DataTable,
  Field,
  Input,
  Modal,
  RowActions,
  Spinner,
  type Column,
} from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaPlayer } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge } from '../../components';
import { PLATFORMS, errorMessage, squadRoleLabel } from '../../utils';
import { ClubAddPlayerModal } from './ClubAddPlayer';
import { ClubFormModal } from './ClubForm';

const NO_PLAYERS: ArenaPlayer[] = [];

/** Give a club a manager by email, or replace the current one. Mount only while open. */
const ManagerModal = ({ club, onClose }: { club: ArenaClub; onClose: () => void }) => {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => arenaApi.setClubManager(club.id, email.trim()),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`${c.manager_name || c.manager_email || email.trim()} now manages ${c.name}.`);
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (email.trim()) mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={mutation.isPending ? undefined : onClose}
      title={club.manager_user_id ? 'Change manager' : 'Assign a manager'}
      subtitle={club.manager_user_id ? 'The new manager takes over. The current one loses access to this club.' : 'The manager picks the team sheet and makes offers to players.'}
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="arena-manager-form" loading={mutation.isPending}>
            {club.manager_user_id ? 'Change manager' : 'Assign manager'}
          </Button>
        </>
      }
    >
      <form id="arena-manager-form" onSubmit={submit} noValidate>
        <Field
          label="Manager's email"
          htmlFor="manager-email"
          hint="They must already have an Arena account. Ask them to sign up first if they don't."
          error={submitted && !email.trim() ? 'Enter the manager’s email.' : ''}
        >
          <Input id="manager-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" invalid={submitted && !email.trim()} placeholder="manager@example.com" />
        </Field>
      </form>
    </Modal>
  );
};

export const ArenaAdminClubDetail = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [managerModal, setManagerModal] = useState(false);
  const [removingManager, setRemovingManager] = useState(false);
  const [releasing, setReleasing] = useState<ArenaPlayer | null>(null);

  const clubQuery = useQuery({ queryKey: ['arena', 'admin', 'club', id], queryFn: () => arenaApi.adminClub(id), enabled: !!id });
  const squadQuery = useQuery({
    queryKey: ['arena', 'admin', 'club-squad', id],
    queryFn: () => arenaApi.adminPlayers({ club_id: id, limit: 100 }),
    enabled: !!id,
  });
  const club = clubQuery.data;
  const squad = squadQuery.data ?? NO_PLAYERS;

  const removeManager = useMutation({
    mutationFn: () => arenaApi.setClubManager(id, ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success('Manager removed.');
      setRemovingManager(false);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setRemovingManager(false);
    },
  });

  const release = useMutation({
    mutationFn: (p: ArenaPlayer) => arenaApi.releasePlayer(p.id),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['arena'] });
      toast.success(`${p.gamertag} released. They are now a free agent.`);
      setReleasing(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setReleasing(null);
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
      {
        header: 'Shirt',
        sortValue: (p) => p.shirt_number ?? 999,
        sortable: true,
        cell: (p) => <span className="tabular font-bold">{p.shirt_number ?? '—'}</span>,
      },
      { header: 'Position', accessor: 'primary_position', sortable: true },
      { header: 'Platform', cell: (p) => PLATFORMS.find((x) => x.value === p.platform)?.label ?? p.platform },
      { header: 'Squad role', cell: (p) => squadRoleLabel(p.squad_role) || '—' },
      {
        header: 'Actions',
        align: 'right',
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.gamertag}`}
            actions={[
              { label: 'Open profile', icon: EyeIcon, onSelect: () => navigate(`/players/${p.id}`) },
              { label: 'Release from club', icon: UserMinusIcon, danger: true, onSelect: () => setReleasing(p), hint: 'They become a free agent' },
            ]}
          />
        ),
      },
    ],
    [navigate],
  );

  if (clubQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading club" />
      </div>
    );
  }
  if (!club) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Club" subtitle="This club could not be loaded." back={{ to: '/admin/clubs', label: 'Clubs' }} />
        <Panel title="Club not found">
          <EmptyState title="We couldn't find this club" description="It may have been deleted. Go back to the list to pick another." action={<ButtonLink to="/admin/clubs">Back to clubs</ButtonLink>} />
        </Panel>
      </div>
    );
  }

  const subtitle = [club.division_name ?? 'Not in a division', club.founded_year ? `Founded ${club.founded_year}` : null].filter(Boolean).join(' · ');
  const archived = club.status === 'archived';

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={club.name}
        subtitle={subtitle}
        back={{ to: '/admin/clubs', label: 'Clubs' }}
        actions={
          <>
            <Button variant="secondary" icon={PencilSquareIcon} onClick={() => setEditing(true)}>
              Edit club
            </Button>
            <Button icon={PlusIcon} onClick={() => setAdding(true)} disabled={archived}>
              Add player
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Club">
          <div className="flex items-center gap-4">
            <Crest club={club} size="xl" />
            <div className="min-w-0 space-y-1">
              <p className="break-words text-lg font-black text-sffl-navy dark:text-white">{club.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Code <span className="font-bold">{club.short}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={archived ? 'neutral' : 'success'}>{archived ? 'Archived' : 'Active'}</StatusBadge>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: club.color }} />
                  {club.color}
                </span>
              </div>
              <Link to={`/clubs/${club.slug}`} className="inline-flex min-h-11 items-center text-sm font-bold text-sffl-red hover:underline dark:text-arena-lime">
                View public page
              </Link>
            </div>
          </div>
          {archived && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">This club is archived, so players can't be added to it. Restore it from the Clubs list first.</p>}
        </Panel>

        <Panel title="Manager">
          {club.manager_user_id ? (
            <div className="space-y-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-sffl-navy dark:text-white">{club.manager_name || club.manager_email}</p>
                {club.manager_name && club.manager_email && <p className="truncate text-sm text-gray-600 dark:text-gray-400">{club.manager_email}</p>}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Picks the team sheet for each match and makes contract offers.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={UserPlusIcon} onClick={() => setManagerModal(true)}>
                  Change manager
                </Button>
                <Button variant="outline" icon={UserMinusIcon} onClick={() => setRemovingManager(true)}>
                  Remove manager
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={UserPlusIcon}
              title="No manager yet"
              description="Without a manager, nobody can pick this club's team or make offers. Give it one using the email of their Arena account."
              action={<Button icon={UserPlusIcon} onClick={() => setManagerModal(true)}>Assign a manager</Button>}
            />
          )}
        </Panel>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-extrabold text-sffl-navy dark:text-white">Squad</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{squad.length === 1 ? '1 player' : `${squad.length} players`} registered to {club.name} this season.</p>
        </div>
        {!squadQuery.isLoading && squad.length === 0 ? (
          <Panel title="No players yet">
            <EmptyState
              icon={UserGroupIcon}
              title="This squad is empty"
              description="A club needs players before its manager can pick a team. Add a free agent or create a new player."
              action={
                <Button icon={PlusIcon} onClick={() => setAdding(true)} disabled={archived}>
                  Add player
                </Button>
              }
            />
          </Panel>
        ) : (
          <DataTable
            data={squad}
            columns={columns}
            loading={squadQuery.isLoading}
            getRowId={(p) => p.id}
            searchPlaceholder="Search the squad"
            emptyMessage="No players match."
            itemsPerPage={25}
          />
        )}
      </section>

      {editing && <ClubFormModal club={club} onClose={() => setEditing(false)} />}
      {adding && <ClubAddPlayerModal club={club} onClose={() => setAdding(false)} />}
      {managerModal && <ManagerModal club={club} onClose={() => setManagerModal(false)} />}

      <ConfirmDialog
        open={removingManager}
        title="Remove this club's manager?"
        description="They lose access to the club's team sheets and offers straight away. You can assign someone else afterwards."
        confirmLabel="Remove manager"
        tone="warning"
        icon={UserMinusIcon}
        pending={removeManager.isPending}
        body={<ConfirmSummary rows={[['Club', club.name], ['Manager', club.manager_name || club.manager_email]]} />}
        onConfirm={() => removeManager.mutate()}
        onCancel={() => setRemovingManager(false)}
      />
      <ConfirmDialog
        open={!!releasing}
        title="Release this player?"
        description="They leave the squad and become a free agent. They are taken off any team sheets that haven't been played, and those sheets go back to draft."
        confirmLabel="Release player"
        tone="warning"
        icon={ArrowRightStartOnRectangleIcon}
        pending={release.isPending}
        body={releasing && <ConfirmSummary rows={[['Player', releasing.gamertag], ['Club', club.name], ['Shirt', releasing.shirt_number ? String(releasing.shirt_number) : undefined]]} />}
        onConfirm={() => releasing && release.mutate(releasing)}
        onCancel={() => setReleasing(null)}
      />
    </div>
  );
};
