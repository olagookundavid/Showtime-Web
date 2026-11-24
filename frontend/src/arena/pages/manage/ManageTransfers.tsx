import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  EyeIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  Button,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  DataTable,
  Field,
  Input,
  RowActions,
  Tabs,
  type Column,
  type RowAction,
} from '../../../components';
import { useDebounced } from '../../../hooks';
import { arenaApi } from '../../../services';
import type { ArenaContract, ArenaPlayer } from '../../../types';
import { EmptyState, Panel, PlayerFace, StatusBadge, contractTone } from '../../components';
import { arenaKeys, useArenaMe } from '../../hooks';
import {
  CONTRACT_STATUS_LABEL,
  PLATFORMS,
  errorMessage,
  formatDateOnly,
  formatDateTime,
  formatNaira,
  squadRoleLabel,
} from '../../utils';
import { MANAGE_KEY, NO_CONTRACTS, isOpenContract, manageKeys, useTransferWindow } from './ContractShared';
import { OfferDeclineModal } from './OfferDeclineModal';
import { OfferDetailModal } from './OfferDetailModal';
import { OfferMakeModal } from './OfferMakeModal';

type Tab = 'offers' | 'requests' | 'free';
type PendingAction = { kind: 'withdraw' | 'approve'; contract: ArenaContract };

const NO_PLAYERS: ArenaPlayer[] = [];
const TABS: Tab[] = ['offers', 'requests', 'free'];
const CLOSED_HINT = 'The transfer window is closed.';

const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

const FeeNote = () => (
  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Fees are recorded only. Nothing is charged in this version.</p>
);

export const ArenaManageTransfers = () => {
  const qc = useQueryClient();
  const me = useArenaMe();
  const tw = useTransferWindow();
  const [params, setParams] = useSearchParams();

  const requested = params.get('tab');
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : 'offers';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  const myId = me.data?.managed_club?.id ?? '';
  const contractsQ = useQuery({ queryKey: manageKeys.contracts, queryFn: () => arenaApi.manageContracts() });
  const all = contractsQ.data ?? NO_CONTRACTS;
  const made = useMemo(() => all.filter((c) => c.club_id === myId), [all, myId]);
  const requests = useMemo(() => all.filter((c) => c.from_club_id === myId && c.status === 'awaiting_release'), [all, myId]);
  const blockedPlayerIds = useMemo(() => new Set(made.filter(isOpenContract).map((c) => c.player_id)), [made]);

  const [agentSearch, setAgentSearch] = useState('');
  const agentTerm = useDebounced(agentSearch.trim(), 300);
  const agentsQ = useQuery({
    queryKey: manageKeys.freeAgents(agentTerm),
    queryFn: () => arenaApi.freeAgents(agentTerm),
    enabled: tab === 'free',
  });

  const [makeFor, setMakeFor] = useState<{ player: ArenaPlayer | null } | null>(null);
  const [viewing, setViewing] = useState<ArenaContract | null>(null);
  const [declining, setDeclining] = useState<ArenaContract | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: MANAGE_KEY });
    qc.invalidateQueries({ queryKey: arenaKeys.me });
  };

  const act = useMutation({
    mutationFn: ({ kind, contract }: PendingAction) =>
      kind === 'withdraw' ? arenaApi.withdrawOffer(contract.id) : arenaApi.approveRelease(contract.id),
    onSuccess: (_data, { kind, contract }) => {
      toast.success(kind === 'withdraw' ? `Your offer to ${contract.player_name} was withdrawn.` : `${contract.player_name} can now decide on ${contract.club_name}'s offer.`);
      refresh();
      setPending(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setPending(null);
    },
  });

  const closed = tw.closed;

  const offerColumns = useMemo<Column<ArenaContract>[]>(
    () => [
      { header: 'Player', accessor: 'player_name', sortable: true, cell: (c) => <span className="font-bold text-sffl-navy dark:text-white">{c.player_name}</span> },
      {
        header: 'Status',
        accessor: 'status',
        sortable: true,
        sortValue: (c) => CONTRACT_STATUS_LABEL[c.status],
        cell: (c) => <StatusBadge tone={contractTone(c.status)}>{CONTRACT_STATUS_LABEL[c.status]}</StatusBadge>,
      },
      { header: 'Current club', accessor: 'from_club_name', cell: (c) => c.from_club_name || 'Free agent' },
      { header: 'Squad role', accessor: 'squad_role', sortable: true, cell: (c) => squadRoleLabel(c.squad_role) },
      { header: 'Ends', accessor: 'end_date', sortable: true, cell: (c) => formatDateOnly(c.end_date) },
      { header: 'Fee', accessor: 'fee_ngn', sortable: true, align: 'right', cell: (c) => <span className="tabular">{formatNaira(c.fee_ngn)}</span> },
      { header: 'Updated', accessor: 'updated_at', sortable: true, cell: (c) => formatDateTime(c.updated_at) },
      {
        header: 'Actions',
        align: 'right',
        cell: (c) => {
          const actions: RowAction[] = [
            { label: 'View details', icon: EyeIcon, onSelect: () => setViewing(c) },
            {
              label: 'Withdraw offer',
              icon: ArrowUturnLeftIcon,
              danger: true,
              disabled: !isOpenContract(c),
              hint: isOpenContract(c) ? undefined : 'Only open offers can be withdrawn.',
              onSelect: () => setPending({ kind: 'withdraw', contract: c }),
            },
          ];
          return <RowActions label={`Actions for the offer to ${c.player_name}`} actions={actions} />;
        },
      },
    ],
    [],
  );

  const requestColumns = useMemo<Column<ArenaContract>[]>(
    () => [
      { header: 'Player', accessor: 'player_name', sortable: true, cell: (c) => <span className="font-bold text-sffl-navy dark:text-white">{c.player_name}</span> },
      { header: 'Club asking', accessor: 'club_name', sortable: true },
      { header: 'Squad role', accessor: 'squad_role', sortable: true, cell: (c) => squadRoleLabel(c.squad_role) },
      { header: 'Ends', accessor: 'end_date', sortable: true, cell: (c) => formatDateOnly(c.end_date) },
      { header: 'Received', accessor: 'created_at', sortable: true, cell: (c) => formatDateTime(c.created_at) },
      {
        header: 'Actions',
        align: 'right',
        cell: (c) => {
          const actions: RowAction[] = [
            {
              label: 'Approve release',
              icon: CheckCircleIcon,
              disabled: closed,
              hint: closed ? CLOSED_HINT : undefined,
              onSelect: () => setPending({ kind: 'approve', contract: c }),
            },
            { label: 'Decline request', icon: XCircleIcon, danger: true, onSelect: () => setDeclining(c) },
            { label: 'View details', icon: EyeIcon, onSelect: () => setViewing(c) },
          ];
          return <RowActions label={`Actions for the request for ${c.player_name}`} actions={actions} />;
        },
      },
    ],
    [closed],
  );

  const agentColumns = useMemo<Column<ArenaPlayer>[]>(
    () => [
      {
        header: 'Player',
        accessor: 'gamertag',
        sortable: true,
        cell: (p) => (
          <span className="flex min-w-0 items-center gap-3">
            <PlayerFace name={p.gamertag} src={p.avatar_url} size="sm" />
            <span className="truncate font-bold text-sffl-navy dark:text-white">{p.gamertag}</span>
          </span>
        ),
      },
      { header: 'Position', accessor: 'primary_position', sortable: true },
      { header: 'Platform', accessor: 'platform', sortable: true, cell: (p) => platformLabel(p.platform) },
      {
        header: 'Actions',
        align: 'right',
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.gamertag}`}
            actions={[
              {
                label: 'Make offer',
                icon: PaperAirplaneIcon,
                disabled: closed || blockedPlayerIds.has(p.id),
                hint: closed ? CLOSED_HINT : blockedPlayerIds.has(p.id) ? 'You already have an open offer to this player.' : undefined,
                onSelect: () => setMakeFor({ player: p }),
              },
            ]}
          />
        ),
      },
    ],
    [closed, blockedPlayerIds],
  );

  const makeOfferButton = (
    <Button icon={PaperAirplaneIcon} disabled={closed} title={closed ? CLOSED_HINT : undefined} onClick={() => setMakeFor({ player: null })}>
      Make an offer
    </Button>
  );

  const loadError = contractsQ.isError && (
    <Panel title="We couldn't load your transfers">
      <EmptyState
        title="Something went wrong"
        description={errorMessage(contractsQ.error, 'Your transfers could not be loaded. Please try again.')}
        action={<Button onClick={() => contractsQ.refetch()}>Try again</Button>}
      />
    </Panel>
  );

  const agents = agentsQ.data ?? NO_PLAYERS;

  return (
    <div className="space-y-6 pb-mobile-nav-2x">
      <DashboardPageHeader
        title="Transfers"
        subtitle="Offer contracts to players, and answer other clubs who want one of yours."
        actions={makeOfferButton}
      />

      {closed && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <LockClosedIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-bold">The transfer window is closed.</span> Offers can't be made or signed, and releases can't be approved, until the organiser opens it. You can still look at your offers, withdraw them and decline requests.
          </p>
        </div>
      )}

      <Tabs
        aria-label="Transfer sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'offers', label: `Offers I've made${made.length ? ` (${made.length})` : ''}` },
          { value: 'requests', label: `Release requests${requests.length ? ` (${requests.length})` : ''}` },
          { value: 'free', label: 'Free agents' },
        ]}
      />

      {tab === 'offers' &&
        (loadError || (
          <Panel title="Offers I've made" flush={made.length > 0 || contractsQ.isLoading}>
            {made.length === 0 && !contractsQ.isLoading ? (
              <EmptyState
                icon={PaperAirplaneIcon}
                title="You haven't made any offers yet"
                description="Offer a contract to a free agent, or to a player at another club, to grow your squad."
                action={makeOfferButton}
              />
            ) : (
              <>
                <div className="px-4 sm:px-5">
                  <FeeNote />
                </div>
                <DataTable data={made} columns={offerColumns} getRowId={(c) => c.id} loading={contractsQ.isLoading} searchPlaceholder="Search your offers" emptyMessage="No offers found." />
              </>
            )}
          </Panel>
        ))}

      {tab === 'requests' &&
        (loadError || (
          <Panel title="Release requests" flush={requests.length > 0 || contractsQ.isLoading}>
            {requests.length === 0 && !contractsQ.isLoading ? (
              <EmptyState
                icon={UserGroupIcon}
                title="No release requests"
                description="When another club offers a contract to one of your players, it shows up here for you to approve or decline."
              />
            ) : (
              <>
                <p className="mb-3 px-4 text-sm text-gray-600 sm:px-5 dark:text-gray-400">
                  These clubs want to sign players from your squad. Approving only lets the player see the offer. The decision is theirs, and they stay with you until they sign.
                </p>
                <DataTable data={requests} columns={requestColumns} getRowId={(c) => c.id} loading={contractsQ.isLoading} searchPlaceholder="Search requests" emptyMessage="No requests found." />
              </>
            )}
          </Panel>
        ))}

      {tab === 'free' && (
        <Panel title="Free agents" flush>
          <div className="space-y-3 px-4 pb-3 sm:px-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Players with no club. They get your offer straight away. To sign someone from another club, use Make an offer and search for them.
            </p>
            <Field label="Search free agents" htmlFor="free-agent-search">
              <Input
                id="free-agent-search"
                icon={MagnifyingGlassIcon}
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Search by gamertag"
                autoComplete="off"
              />
            </Field>
          </div>
          {!agentsQ.isLoading && agents.length === 0 && !agentsQ.isError ? (
            <EmptyState
              icon={UserGroupIcon}
              title={agentTerm ? `No free agents match "${agentTerm}"` : 'There are no free agents right now'}
              description={agentTerm ? 'Check the spelling, or search every player with Make an offer.' : 'Players released by their clubs will appear here.'}
              action={makeOfferButton}
            />
          ) : agentsQ.isError ? (
            <EmptyState
              title="Something went wrong"
              description={errorMessage(agentsQ.error)}
              action={<Button onClick={() => agentsQ.refetch()}>Try again</Button>}
            />
          ) : (
            <DataTable data={agents} columns={agentColumns} getRowId={(p) => p.id} loading={agentsQ.isLoading} searchable={false} emptyMessage="No free agents found." />
          )}
        </Panel>
      )}

      {makeFor && (
        <OfferMakeModal
          preselected={makeFor.player}
          myClubId={myId}
          blockedPlayerIds={blockedPlayerIds}
          seasonEnd={tw.season?.ends_on ?? null}
          onClose={() => setMakeFor(null)}
        />
      )}
      {viewing && <OfferDetailModal contract={viewing} onClose={() => setViewing(null)} />}
      {declining && <OfferDeclineModal contract={declining} onClose={() => setDeclining(null)} />}

      <ConfirmDialog
        open={pending?.kind === 'withdraw'}
        title="Withdraw this offer?"
        description="The offer ends and the player can no longer sign it. You can make a new one later."
        body={
          pending && (
            <ConfirmSummary
              rows={[
                ['Player', pending.contract.player_name],
                ['Status', CONTRACT_STATUS_LABEL[pending.contract.status]],
                ['Contract ends', formatDateOnly(pending.contract.end_date)],
              ]}
            />
          )
        }
        confirmLabel="Withdraw offer"
        tone="warning"
        icon={ArrowUturnLeftIcon}
        pending={act.isPending}
        onConfirm={() => pending && act.mutate(pending)}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'approve'}
        title="Approve this release?"
        description={
          pending
            ? `${pending.contract.player_name} will be told ${pending.contract.club_name} wants to sign them. The decision is then theirs: they can still turn it down, and they stay in your squad until they sign.`
            : undefined
        }
        body={
          pending && (
            <ConfirmSummary
              rows={[
                ['Player', pending.contract.player_name],
                ['Club asking', pending.contract.club_name],
                ['Squad role', squadRoleLabel(pending.contract.squad_role)],
                ['Contract ends', formatDateOnly(pending.contract.end_date)],
              ]}
            />
          )
        }
        confirmLabel="Approve release"
        tone="success"
        icon={CheckCircleIcon}
        pending={act.isPending}
        onConfirm={() => pending && act.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};
