import { useQuery } from '@tanstack/react-query';
import { Button, Modal, Spinner } from '../../../components';
import { arenaApi } from '../../../services';
import type { ArenaContract } from '../../../types';
import { StatusBadge, contractTone } from '../../components';
import { CONTRACT_STATUS_LABEL, errorMessage, formatDateOnly, formatDateTime, formatNaira, squadRoleLabel } from '../../utils';
import { manageKeys } from './ContractShared';

interface OfferDetailModalProps {
  /** The row the manager opened. Shown straight away while the full record (with its history) loads. */
  contract: ArenaContract;
  onClose: () => void;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
    <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="min-w-0 wrap-break-word text-sm font-bold text-gray-900 dark:text-white">{children}</dd>
  </div>
);

/** One offer's terms and everything that has happened to it. */
export const OfferDetailModal = ({ contract, onClose }: OfferDetailModalProps) => {
  const q = useQuery({
    queryKey: manageKeys.contract(contract.id),
    queryFn: () => arenaApi.manageContract(contract.id),
    placeholderData: contract,
  });
  const c = q.data ?? contract;
  const events = c.events ?? [];

  return (
    <Modal shape="square"
      open
      onClose={onClose}
      title={`Offer to ${c.player_name}`}
      subtitle={`From ${c.club_name}`}
      maxWidth="xl"
      footer={
        <Button shape="square" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <dl className="space-y-3">
          <Row label="Status">
            <StatusBadge tone={contractTone(c.status)}>{CONTRACT_STATUS_LABEL[c.status]}</StatusBadge>
          </Row>
          <Row label="Player">{c.player_name}</Row>
          <Row label="Current club">{c.from_club_name || 'Free agent'}</Row>
          <Row label="Squad role">{squadRoleLabel(c.squad_role)}</Row>
          <Row label="Contract ends">{formatDateOnly(c.end_date)}</Row>
          <Row label="Fee">
            {formatNaira(c.fee_ngn)}
            <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">Recorded only. Nothing is charged in this version.</span>
          </Row>
          <Row label="Terms">
            <span className="block whitespace-pre-wrap font-normal">{c.terms}</span>
          </Row>
          {c.reason && <Row label="Reason given">{c.reason}</Row>}
          {c.signed_at && (
            <Row label="Signed">
              {c.signature} on {formatDateTime(c.signed_at)}
            </Row>
          )}
        </dl>

        <section aria-labelledby="offer-history">
          <h3 id="offer-history" className="mb-2 text-base font-extrabold text-sffl-navy dark:text-white">
            History
          </h3>
          {q.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(q.error, 'The history could not be loaded.')}</p>
          ) : q.isPlaceholderData ? (
            <Spinner size="sm" className="py-3" label="Loading history" />
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Nothing has happened to this offer yet.</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-gray-200 pl-4 dark:border-white/15">
              {events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="text-sm">
                  <p className="font-bold text-gray-900 dark:text-white">{e.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(e.at)} WAT</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
};
