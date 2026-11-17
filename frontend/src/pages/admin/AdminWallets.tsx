import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { MagnifyingGlassIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import {
  Button,
  ConfirmDialog,
  ConfirmSummary,
  DashboardPageHeader,
  DataTable,
  Field,
  Input,
  LedgerTable,
  Modal,
  Select,
  type Column,
} from "../../components";
import {
  adminAdjustWallet,
  adminGetUserWallet,
  adminSearchWalletUsers,
  formatKobo,
} from "../../services";
import { getApiErrorMessage } from "../../utils";
import type { WalletUser } from "../../types";

const NO_USERS: WalletUser[] = [];

type Direction = "credit" | "debit";

const nairaToKobo = (text: string): number | null => {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const kobo = Math.round(parseFloat(clean) * 100);
  return kobo > 0 ? kobo : null;
};

const AdminWallets = () => {
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WalletUser | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("credit");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const users = useQuery({
    queryKey: ["adminWalletUsers", search],
    queryFn: () => adminSearchWalletUsers(search),
    enabled: search.trim().length >= 3,
  });

  const wallet = useQuery({
    queryKey: ["adminUserWallet", selected?.id],
    queryFn: () => adminGetUserWallet(selected!.id),
    enabled: !!selected,
  });

  const amountKobo = nairaToKobo(amountText);
  const canReview = amountKobo !== null && reason.trim().length > 0;
  const signedKobo = amountKobo === null ? 0 : direction === "credit" ? amountKobo : -amountKobo;

  const adjust = useMutation({
    mutationFn: () => adminAdjustWallet(selected!.id, signedKobo, reason.trim()),
    onSuccess: () => {
      toast.success("Wallet updated");
      queryClient.invalidateQueries({ queryKey: ["adminUserWallet", selected?.id] });
      setConfirming(false);
      setAdjustOpen(false);
      setAmountText("");
      setReason("");
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(getApiErrorMessage(err, "We could not change that wallet."));
    },
  });

  const columns = useMemo<Column<WalletUser>[]>(
    () => [
      {
        header: "Name",
        sortable: true,
        sortValue: (u) => u.name,
        cell: (u) => (
          <button
            type="button"
            className="font-bold text-sffl-red hover:underline text-left"
            onClick={() => setSelected(u)}
          >
            {u.name || u.email}
          </button>
        ),
      },
      { header: "Email", sortable: true, sortValue: (u) => u.email, cell: (u) => u.email },
    ],
    [],
  );

  return (
    <div className="space-y-6 pb-mobile-nav-2x">
      <DashboardPageHeader
        title="Wallets"
        subtitle="Look up a user's wallet, see everything that went in and out, and credit or debit it by hand."
      />

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchText.trim());
        }}
      >
        <Field
          label="Find a user"
          htmlFor="wallet-user-search"
          hint="Type at least 3 letters of their name or email."
          className="flex-1"
        >
          <Input
            id="wallet-user-search"
            icon={MagnifyingGlassIcon}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Name or email"
          />
        </Field>
        <Button type="submit" disabled={searchText.trim().length < 3}>
          Search
        </Button>
      </form>

      {search.trim().length >= 3 && (
        <DataTable
          data={users.data ?? NO_USERS}
          columns={columns}
          loading={users.isLoading}
          searchable={false}
          paginated={false}
          compact
          getRowId={(u) => u.id}
          emptyMessage="No users match that search."
        />
      )}

      {selected && (
        <section aria-labelledby="wallet-detail" className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 id="wallet-detail" className="text-lg font-black text-sffl-navy dark:text-white truncate">
                {wallet.data?.user.name || selected.name || selected.email}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {wallet.data?.user.email ?? selected.email}
              </p>
              <p className="text-3xl font-black text-sffl-navy dark:text-white mt-2 break-words">
                {wallet.data ? formatKobo(wallet.data.balance_kobo) : "—"}
              </p>
            </div>
            <Button
              icon={PencilSquareIcon}
              disabled={!wallet.data}
              onClick={() => setAdjustOpen(true)}
            >
              Adjust Balance
            </Button>
          </div>

          <LedgerTable entries={wallet.data?.transactions} loading={wallet.isLoading} />
        </section>
      )}

      <Modal
        open={adjustOpen}
        onClose={() => !adjust.isPending && setAdjustOpen(false)}
        title="Adjust wallet balance"
        subtitle="Use this to fix a mistake or give a goodwill credit. The reason is saved in the ledger."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="adjust-form" disabled={!canReview}>
              Review
            </Button>
          </>
        }
      >
        <form
          id="adjust-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canReview) setConfirming(true);
          }}
        >
          <Field label="Action" htmlFor="adjust-direction">
            <Select
              id="adjust-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
            >
              <option value="credit">Add money (credit)</option>
              <option value="debit">Take money away (debit)</option>
            </Select>
          </Field>
          <Field label="Amount (₦)" htmlFor="adjust-amount">
            <Input
              id="adjust-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="1000"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </Field>
          <Field label="Reason" htmlFor="adjust-reason" hint="Required. Shown to the user in their history.">
            <Input
              id="adjust-reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Refund for a cancelled event"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title={direction === "credit" ? "Add money to this wallet?" : "Take money from this wallet?"}
        description="This is recorded in the wallet's history under your name."
        body={
          <ConfirmSummary
            rows={[
              ["User", wallet.data?.user.name || selected?.email],
              ["Change", `${signedKobo > 0 ? "+" : "-"}${formatKobo(Math.abs(signedKobo))}`],
              ["Reason", reason.trim()],
            ]}
          />
        }
        confirmLabel={direction === "credit" ? "Add money" : "Take money"}
        tone={direction === "credit" ? "info" : "warning"}
        icon={PencilSquareIcon}
        pending={adjust.isPending}
        onConfirm={() => adjust.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};

export default AdminWallets;
