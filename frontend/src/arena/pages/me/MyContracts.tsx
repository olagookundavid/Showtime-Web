import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircleIcon, DocumentTextIcon, EyeIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Button, Checkbox, ConfirmDialog, DashboardPageHeader, DataTable, Field, Input, Modal, RowActions, Spinner, Textarea, type Column } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaContract } from '../../../types';
import { Crest, EmptyState, Panel, StatusBadge, contractTone } from '../../components';
import { arenaKeys, useArenaMe } from '../../hooks';
import { CONTRACT_STATUS_LABEL, errorMessage, formatDateOnly, formatDateTime, formatNaira, squadRoleLabel } from '../../utils';

const NO_CONTRACTS: ArenaContract[] = [];

/** A contract names its club by colour and code only, which is enough for a crest. */
const clubOf = (c: ArenaContract) => ({ name: c.club_name, short: c.club_short, color: c.club_color, crest_url: '' });

/** Read the terms, then sign or turn the offer down. */
const OfferModal = ({ contract, gamertag, onClose }: { contract: ArenaContract; gamertag: string; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['arena', 'my-contract', contract.id], queryFn: () => arenaApi.myContract(contract.id) });
  const [signature, setSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const c = detail.data ?? contract;
  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['arena', 'my-contracts'] });
    queryClient.invalidateQueries({ queryKey: arenaKeys.me });
    queryClient.invalidateQueries({ queryKey: ['arena', 'my-contract', contract.id] });
  };

  const sign = useMutation({
    mutationFn: () => arenaApi.sign(contract.id, signature, consent),
    onSuccess: () => {
      toast.success(`Contract signed. Welcome to ${contract.club_name}.`);
      done();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => arenaApi.reject(contract.id, reason),
    onSuccess: () => {
      toast.success('Offer rejected.');
      setRejecting(false);
      done();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canDecide = c.status === 'awaiting_player';
  return (
    <>
      <Modal open onClose={onClose} title="Player agreement" subtitle={`${c.club_name} · ${CONTRACT_STATUS_LABEL[c.status]}`} maxWidth="2xl"
        footer={
          canDecide ? (
            <>
              <Button variant="secondary" onClick={onClose}>Decide later</Button>
              <Button variant="danger" icon={XCircleIcon} onClick={() => setRejecting(true)}>Reject offer</Button>
              <Button type="submit" form="sign-form" variant="success" icon={CheckCircleIcon} loading={sign.isPending}>Agree and sign</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>Close</Button>
          )
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Crest club={clubOf(c)} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-sffl-navy dark:text-white">{c.club_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{c.from_club_name ? `You are at ${c.from_club_name}` : 'You are a free agent'}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Squad role', squadRoleLabel(c.squad_role)],
              ['Contract ends', formatDateOnly(c.end_date)],
              ['Season fee', `${formatNaira(c.fee_ngn)} (recorded only)`],
              ['Status', CONTRACT_STATUS_LABEL[c.status]],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="font-bold text-sffl-navy dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-500">Terms of the offer</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{c.terms}</p>
          </div>
          {c.reason && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Note: {c.reason}</p>}
          {c.status === 'awaiting_release' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              This offer is waiting for {c.from_club_name || 'your current club'} to release you. You can sign once they agree.
            </p>
          )}
          {c.signature && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">Signed by <b>{c.signature}</b> on {formatDateTime(c.signed_at)}.</p>}

          {canDecide && (
            <form
              id="sign-form"
              onSubmit={(e) => {
                e.preventDefault();
                sign.mutate();
              }}
              className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-white/10"
            >
              <Field label="To sign, type your gamertag" htmlFor="sign-name" hint={`Type ${gamertag} exactly as it appears on your profile.`}>
                <Input id="sign-name" autoComplete="off" required value={signature} onChange={(e) => setSignature(e.target.value)} />
              </Field>
              <Checkbox label={`I have read the terms and agree to join ${c.club_name}.`} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            </form>
          )}

          {(detail.data?.events?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-500">Agreement history</h3>
              <ol className="mt-2 space-y-2 border-l-2 border-gray-200 pl-4 dark:border-white/10">
                {detail.data?.events?.map((e, i) => (
                  <li key={i} className="text-sm text-gray-800 dark:text-gray-200">
                    {e.label}
                    <span className="block text-xs text-gray-500">{formatDateTime(e.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={rejecting}
        title="Reject this offer?"
        description={`${c.club_name} will be told you turned it down. You can still accept other offers.`}
        body={
          <Field label="Reason (optional)" htmlFor="reject-reason">
            <Textarea id="reject-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        }
        confirmLabel="Reject offer"
        tone="warning"
        icon={XCircleIcon}
        pending={reject.isPending}
        onConfirm={() => reject.mutate()}
        onCancel={() => setRejecting(false)}
      />
    </>
  );
};

export const ArenaMyContracts = () => {
  const me = useArenaMe();
  const query = useQuery({ queryKey: ['arena', 'my-contracts'], queryFn: arenaApi.myContracts });
  const [open, setOpen] = useState<ArenaContract | null>(null);

  const columns = useMemo<Column<ArenaContract>[]>(
    () => [
      {
        header: 'Club',
        cell: (c) => (
          <button type="button" onClick={() => setOpen(c)} className="inline-flex min-h-11 items-center gap-2 text-left font-bold text-sffl-navy hover:underline dark:text-white">
            <Crest club={clubOf(c)} size="sm" />
            <span className="whitespace-nowrap">{c.club_name}</span>
          </button>
        ),
      },
      { header: 'Role', cell: (c) => squadRoleLabel(c.squad_role) },
      { header: 'Ends', cell: (c) => formatDateOnly(c.end_date) },
      { header: 'Season fee', align: 'right', className: 'tabular', cell: (c) => formatNaira(c.fee_ngn) },
      { header: 'Status', cell: (c) => <StatusBadge tone={contractTone(c.status)}>{CONTRACT_STATUS_LABEL[c.status]}</StatusBadge> },
      { header: 'Offered', cell: (c) => formatDateOnly(c.created_at.slice(0, 10)) },
      {
        header: 'Actions',
        align: 'right',
        cell: (c) => (
          <RowActions
            label={`Actions for the ${c.club_name} offer`}
            actions={[{ label: c.status === 'awaiting_player' ? 'Review and decide' : 'View contract', icon: EyeIcon, onSelect: () => setOpen(c) }]}
          />
        ),
      },
    ],
    [],
  );

  if (me.isLoading || query.isLoading) return <Spinner label="Loading your contracts" className="py-16" />;
  const player = me.data?.player;

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="My Contracts" subtitle="Offers from clubs. Read the terms, then sign or turn them down." />
      {!player ? (
        <Panel title="You need a player profile first">
          <EmptyState
            icon={DocumentTextIcon}
            title="Clubs can't send you offers yet"
            description="Create your player profile so managers can find you and offer you a contract."
            action={<Link to="/me" className="font-bold text-sffl-red underline dark:text-arena-lime">Create my profile</Link>}
          />
        </Panel>
      ) : (
        <Panel title="Contract offers" flush>
          <DataTable
            data={query.data?.length ? query.data : NO_CONTRACTS}
            columns={columns}
            searchable={false}
            paginated={false}
            getRowId={(c) => c.id}
            emptyMessage="No offers yet. When a club offers you a contract it will appear here."
          />
        </Panel>
      )}
      {open && player && <OfferModal contract={open} gamertag={player.gamertag} onClose={() => setOpen(null)} />}
    </div>
  );
};
