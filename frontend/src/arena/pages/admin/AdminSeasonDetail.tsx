import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowUturnLeftIcon,
  FlagIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  Squares2X2Icon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { Button, ButtonLink, ConfirmDialog, ConfirmSummary, DashboardPageHeader, Spinner } from '../../../components';
import { usePermissions } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaClub, ArenaSeasonStatus } from '../../../types';
import { EmptyState, Panel, StatusBadge } from '../../components';
import { errorMessage } from '../../utils';
import { DivisionFormModal } from './DivisionFormModal';
import { DivisionPanel } from './DivisionPanel';
import { SeasonFormModal } from './SeasonFormModal';
import { SEASON_STATUS, invalidateArena, seasonDates, seasonKeys } from './seasonHelpers';

type PendingAction = { kind: 'status'; to: ArenaSeasonStatus } | { kind: 'window'; open: boolean };

interface StageAction {
  to: ArenaSeasonStatus;
  title: string;
  explain: string;
  button: string;
  variant: 'success' | 'info' | 'warning' | 'outline';
  icon: ComponentType<{ className?: string }>;
  confirmDescription: string;
  tone: 'success' | 'info' | 'warning';
}

const START: StageAction = {
  to: 'active',
  title: 'Start the season',
  explain: 'Opens the league: results can be entered and the table starts counting. You need a division with at least 2 clubs.',
  button: 'Start season',
  variant: 'success',
  icon: PlayIcon,
  confirmDescription: 'The league goes live and results can be entered. You can still add divisions and make fixtures afterwards.',
  tone: 'success',
};
const PLAYOFFS: StageAction = {
  to: 'playoffs',
  title: 'Move to the playoffs',
  explain: 'Use this once the league matches are finished. The season shows as being in its knock-out stage.',
  button: 'Start playoffs',
  variant: 'info',
  icon: TrophyIcon,
  confirmDescription: 'The season moves to its playoff stage. You can go back to league play if you change your mind.',
  tone: 'info',
};
const BACK_TO_LEAGUE: StageAction = {
  to: 'active',
  title: 'Back to league play',
  explain: 'Use this if the playoffs were started by mistake.',
  button: 'Back to league play',
  variant: 'outline',
  icon: ArrowUturnLeftIcon,
  confirmDescription: 'The season returns to its league stage.',
  tone: 'info',
};
const COMPLETE: StageAction = {
  to: 'completed',
  title: 'Complete the season',
  explain: "Ends the season for good: tables and results are final and the transfer window closes. This can't be undone.",
  button: 'Complete season',
  variant: 'warning',
  icon: FlagIcon,
  confirmDescription: "The season is finished. Its tables and results become final, the transfer window closes and nothing can be changed afterwards. This can't be undone.",
  tone: 'warning',
};

const NEXT_ACTIONS: Record<ArenaSeasonStatus, StageAction[]> = {
  setup: [START],
  active: [PLAYOFFS, COMPLETE],
  playoffs: [BACK_TO_LEAGUE, COMPLETE],
  completed: [],
};

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-1 text-sm font-bold text-sffl-navy dark:text-white">{children}</dd>
  </div>
);

const ActionBlock = ({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) => (
  <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-gray-200 p-4 dark:border-white/10">
    <div>
      <h3 className="text-sm font-extrabold text-sffl-navy dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{children}</p>
    </div>
    <div>{action}</div>
  </div>
);

export const ArenaAdminSeasonDetail = () => {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { canView } = usePermissions();
  const canSeeClubs = canView('arena_clubs');
  const canEnterResults = canView('arena_results');

  const [editingSeason, setEditingSeason] = useState(false);
  const [addingDivision, setAddingDivision] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: season, isLoading, error, refetch } = useQuery({
    queryKey: seasonKeys.one(id),
    queryFn: () => arenaApi.adminSeason(id),
    enabled: Boolean(id),
  });
  const clubsQuery = useQuery({
    queryKey: seasonKeys.clubs,
    queryFn: () => arenaApi.adminClubs(),
    enabled: canSeeClubs,
  });
  const clubsById = useMemo(
    () => (clubsQuery.data ? new Map<string, ArenaClub>(clubsQuery.data.map((c) => [c.id, c])) : null),
    [clubsQuery.data],
  );

  const divisions = season?.divisions ?? [];
  const clubTotal = divisions.reduce((n, d) => n + d.club_count, 0);

  const closePending = () => setPending(null);
  const onDone = () => {
    invalidateArena(qc);
    setPending(null);
  };
  const onFail = (err: unknown) => {
    setPending(null);
    toast.error(errorMessage(err));
  };

  const setStatus = useMutation({
    mutationFn: (to: ArenaSeasonStatus) => arenaApi.setSeasonStatus(id, to),
    onSuccess: (s) => {
      toast.success(`${s.name} is now ${SEASON_STATUS[s.status].label.toLowerCase()}.`);
      onDone();
    },
    onError: onFail,
  });
  const setWindow = useMutation({
    mutationFn: (open: boolean) => arenaApi.setTransferWindow(id, open),
    onSuccess: (s) => {
      toast.success(s.transfer_window_open ? 'Transfer window opened.' : 'Transfer window closed.');
      onDone();
    },
    onError: onFail,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardPageHeader title="Season" subtitle="Loading the season." back={{ to: '/admin/seasons', label: 'Seasons' }} />
        <Spinner label="Loading season" />
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardPageHeader title="Season" subtitle="This season could not be opened." back={{ to: '/admin/seasons', label: 'Seasons' }} />
        <Panel title="Something went wrong">
          <EmptyState
            icon={TrophyIcon}
            title="Season not found"
            description={errorMessage(error, 'It may have been removed, or you may not have access.')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
                <ButtonLink to="/admin/seasons">All seasons</ButtonLink>
              </div>
            }
          />
        </Panel>
      </div>
    );
  }

  const status = SEASON_STATUS[season.status];
  const completed = season.status === 'completed';
  const stageActions = NEXT_ACTIONS[season.status];
  const stage = pending?.kind === 'status' ? stageActions.find((a) => a.to === pending.to) : undefined;

  const summaryRows: [string, string][] = [
    ['Season', season.name],
    ['Divisions', String(divisions.length)],
    ['Clubs in divisions', String(clubTotal)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title={season.name}
        subtitle="Set up this season's divisions, clubs and fixtures, and move it through its stages."
        back={{ to: '/admin/seasons', label: 'Seasons' }}
        actions={
          !completed && (
            <Button icon={PlusIcon} onClick={() => setAddingDivision(true)}>
              Add division
            </Button>
          )
        }
      />

      <Panel title="Season">
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Status">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </Fact>
            <Fact label="Dates">{seasonDates(season)}</Fact>
            <Fact label="Divisions">
              {divisions.length} {divisions.length === 1 ? 'division' : 'divisions'}, {clubTotal} {clubTotal === 1 ? 'club' : 'clubs'}
            </Fact>
            <Fact label="Transfer window">
              <StatusBadge tone={season.transfer_window_open ? 'success' : 'neutral'}>{season.transfer_window_open ? 'Open' : 'Closed'}</StatusBadge>
            </Fact>
          </dl>
          <p className="text-sm text-gray-600 dark:text-gray-400">{status.blurb}</p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stageActions.map((a) => (
              <ActionBlock
                key={a.title}
                title={a.title}
                action={
                  <Button variant={a.variant} icon={a.icon} onClick={() => setPending({ kind: 'status', to: a.to })}>
                    {a.button}
                  </Button>
                }
              >
                {a.explain}
              </ActionBlock>
            ))}
            <ActionBlock
              title="Transfer window"
              action={
                season.transfer_window_open ? (
                  <Button variant="outline" icon={LockClosedIcon} onClick={() => setPending({ kind: 'window', open: false })}>
                    Close transfer window
                  </Button>
                ) : (
                  <Button variant="info" icon={LockOpenIcon} disabled={completed} onClick={() => setPending({ kind: 'window', open: true })}>
                    Open transfer window
                  </Button>
                )
              }
            >
              {completed && !season.transfer_window_open
                ? "A completed season can't open its transfer window."
                : 'Contracts can only be offered and signed while the window is open. Closing it pauses all transfers.'}
            </ActionBlock>
          </div>

          <div>
            <Button variant="outline" size="sm" icon={PencilSquareIcon} onClick={() => setEditingSeason(true)}>
              Edit season
            </Button>
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-sffl-navy dark:text-white">Divisions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Each division is its own league table. Add the clubs, then make the fixtures.
          </p>
        </div>

        {divisions.length === 0 ? (
          <Panel title="No divisions yet">
            <EmptyState
              icon={Squares2X2Icon}
              title="Add your first division"
              description="A division is a league of clubs that play each other. Add one, put clubs in it, then make its fixtures."
              action={
                !completed && (
                  <Button icon={PlusIcon} onClick={() => setAddingDivision(true)}>
                    Add division
                  </Button>
                )
              }
            />
          </Panel>
        ) : (
          divisions.map((d) => (
            <DivisionPanel
              key={d.id}
              season={season}
              division={d}
              divisions={divisions}
              clubsById={clubsById}
              canManageClubs={canSeeClubs}
              canEnterResults={canEnterResults}
            />
          ))
        )}
      </div>

      {editingSeason && <SeasonFormModal season={season} onClose={() => setEditingSeason(false)} />}
      {addingDivision && <DivisionFormModal seasonId={season.id} onClose={() => setAddingDivision(false)} />}

      <ConfirmDialog
        open={pending?.kind === 'status' && Boolean(stage)}
        title={stage ? `${stage.button}?` : ''}
        description={stage?.confirmDescription}
        body={<ConfirmSummary rows={summaryRows} />}
        confirmLabel={stage?.button ?? 'Confirm'}
        tone={stage?.tone ?? 'info'}
        icon={stage?.icon}
        pending={setStatus.isPending}
        onConfirm={() => pending?.kind === 'status' && setStatus.mutate(pending.to)}
        onCancel={closePending}
      />
      <ConfirmDialog
        open={pending?.kind === 'window'}
        title={pending?.kind === 'window' && pending.open ? 'Open the transfer window?' : 'Close the transfer window?'}
        description={
          pending?.kind === 'window' && pending.open
            ? 'Club managers can start offering contracts, and players can sign or turn them down.'
            : 'No new contracts can be offered or signed until the window is opened again. Offers already made stay as they are.'
        }
        body={<ConfirmSummary rows={[['Season', season.name], ['Window now', season.transfer_window_open ? 'Open' : 'Closed']]} />}
        confirmLabel={pending?.kind === 'window' && pending.open ? 'Open window' : 'Close window'}
        tone={pending?.kind === 'window' && pending.open ? 'success' : 'warning'}
        icon={pending?.kind === 'window' && pending.open ? LockOpenIcon : LockClosedIcon}
        pending={setWindow.isPending}
        onConfirm={() => pending?.kind === 'window' && setWindow.mutate(pending.open)}
        onCancel={closePending}
      />
    </div>
  );
};
