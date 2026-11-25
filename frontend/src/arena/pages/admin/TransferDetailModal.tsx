import { useQuery } from "@tanstack/react-query";
import { Button, Modal, Spinner } from "../../../components";
import { arenaApi } from "../../../services";
import type { ArenaContract } from "../../../types";
import { Crest, StatusBadge, contractTone } from "../../components";
import {
  CONTRACT_STATUS_LABEL,
  formatDateOnly,
  formatDateTime,
  formatNaira,
  squadRoleLabel,
} from "../../utils";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[9rem_1fr] sm:gap-4">
    <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">
      {label}
    </dt>
    <dd className="min-w-0 wrap-break-word text-sm font-semibold text-gray-900 dark:text-white">
      {children}
    </dd>
  </div>
);

/** The full terms of one contract and everything that has happened to it. Mount only while open. */
export const TransferDetailModal = ({
  contract,
  onClose,
}: {
  contract: ArenaContract;
  onClose: () => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["arena", "admin", "contract", contract.id],
    queryFn: () => arenaApi.adminContract(contract.id),
  });
  const k = data ?? contract;

  return (
    <Modal
      shape="square"
      open
      onClose={onClose}
      title={`${k.player_name}: contract`}
      subtitle={`Offered by ${k.club_name}`}
      maxWidth="2xl"
      footer={
        <Button shape="square" variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <dl className="divide-y divide-gray-100 dark:divide-white/10">
        <Row label="Status">
          <StatusBadge tone={contractTone(k.status)}>
            {CONTRACT_STATUS_LABEL[k.status]}
          </StatusBadge>
        </Row>
        <Row label="Player">{k.player_name}</Row>
        <Row label="Offered by">
          <span className="inline-flex items-center gap-2">
            <Crest
              club={{
                name: k.club_name,
                short: k.club_short,
                color: k.club_color,
                crest_url: "",
              }}
              size="sm"
            />
            {k.club_name}
          </span>
        </Row>
        <Row label="From">{k.from_club_name || "Free agent"}</Row>
        <Row label="Squad role">{squadRoleLabel(k.squad_role)}</Row>
        <Row label="Ends">{formatDateOnly(k.end_date)}</Row>
        <Row label="Fee">
          {formatNaira(k.fee_ngn)}
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
            Recorded only. Nothing is charged through Arena.
          </span>
        </Row>
        <Row label="Offered on">{formatDateTime(k.created_at)}</Row>
        {k.signed_at && (
          <Row label="Signed">
            {formatDateTime(k.signed_at)}
            {k.signature && (
              <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                Signed as &ldquo;{k.signature}&rdquo;
              </span>
            )}
          </Row>
        )}
        {k.reason && <Row label="Reason given">{k.reason}</Row>}
        <Row label="Terms">
          <span className="block whitespace-pre-wrap font-normal">
            {k.terms || "—"}
          </span>
        </Row>
      </dl>

      <h3 className="mt-5 text-base font-extrabold text-sffl-navy dark:text-white">
        History
      </h3>
      {isLoading ? (
        <div className="py-4">
          <Spinner label="Loading history" />
        </div>
      ) : k.events && k.events.length > 0 ? (
        <ol className="mt-2 space-y-2">
          {k.events.map((e, i) => (
            <li
              key={`${e.at}-${i}`}
              className="flex flex-col gap-0.5 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:bg-white/5"
            >
              <span className="min-w-0 wrap-break-word text-sm font-semibold text-gray-900 dark:text-white">
                {e.label}
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(e.at)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          No history has been recorded for this contract.
        </p>
      )}
    </Modal>
  );
};
