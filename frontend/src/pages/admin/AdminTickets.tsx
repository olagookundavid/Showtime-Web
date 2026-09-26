import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions, type RowAction } from "../../components/ui/RowActions";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  adminListTickets,
  checkinTicket,
  adminCheckinTicket,
  verifyTicket,
  lookupTicketByCode,
  searchTicketsByEmail,
  getEventDays,
  getAllEventDays,
  type TicketResponse,
  type EventDayResponse,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { formatMatchDate } from "../../utils/dateUtils";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";

type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const apiError = error as ApiError;
    return apiError.response?.data?.error || fallback;
  }
  return fallback;
};

// Game days are dated in Lagos time (WAT), so "today" is too.
const lagosToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(
    new Date(),
  );

const formatEventDate = (date: string) =>
  formatMatchDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const eventDayLabel = (ed: EventDayResponse) =>
  `${ed.title} — ${formatEventDate(ed.date)}`;

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_TICKETS: TicketResponse[] = [];

// Every key action goes through a confirm dialog first.
const ACTIONS = {
  checkin: {
    title: "Check in this ticket?",
    description: "This marks the ticket as used.",
    confirmLabel: "Check In",
    tone: "success",
    icon: CheckCircleIcon,
  },
  verify: {
    title: "Verify payment?",
    description:
      "Checks Paystack for this ticket's payment. If it went through, the ticket becomes PAID.",
    confirmLabel: "Verify Payment",
    tone: "info",
    icon: ShieldCheckIcon,
  },
  force: {
    title: "Force check-in?",
    description:
      "This will verify payment first if pending, then check the ticket in.",
    confirmLabel: "Force Check-in",
    tone: "warning",
    icon: BoltIcon,
  },
} as const;

type TicketAction = keyof typeof ACTIONS;

const statusColor = (status: string) => {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "USED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "FAILED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

// The backend only fills event_date on the code lookup; the table and email
// search send the placeholder "0001-01-01". So trust the loaded game day
// first, and skip that placeholder. If the date is unknown, leave the
// actions on and let the backend decide.
const isPastGameDay = (
  t: TicketResponse,
  eventDayById: Map<string, EventDayResponse>,
  today: string,
) => {
  const date = eventDayById.get(t.event_day_id)?.date ?? t.event_date;
  return !!date && !date.startsWith("0001") && date < today;
};

const TicketSummary = ({
  t,
  showReference,
}: {
  t: TicketResponse;
  showReference: boolean;
}) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
    <dt className="text-gray-500 dark:text-gray-400">Code</dt>
    <dd className="font-mono font-bold text-sffl-navy dark:text-white">
      {t.ticket_code || "—"}
    </dd>
    {t.name && (
      <>
        <dt className="text-gray-500 dark:text-gray-400">Name</dt>
        <dd className="dark:text-white">{t.name}</dd>
      </>
    )}
    <dt className="text-gray-500 dark:text-gray-400">Email</dt>
    <dd className="break-all dark:text-white">{t.email}</dd>
    <dt className="text-gray-500 dark:text-gray-400">Event</dt>
    <dd className="dark:text-white">{t.event_title || "—"}</dd>
    <dt className="text-gray-500 dark:text-gray-400">Tier</dt>
    <dd className="dark:text-white">{t.tier_name || "—"}</dd>
    <dt className="text-gray-500 dark:text-gray-400">Admits</dt>
    <dd className="font-bold dark:text-white">{t.quantity}</dd>
    {showReference && (
      <>
        <dt className="text-gray-500 dark:text-gray-400">Reference</dt>
        <dd className="font-mono break-all dark:text-white">
          {t.paystack_reference || "—"}
        </dd>
      </>
    )}
  </dl>
);

// Defined at module level so it keeps its identity between renders. Every
// row gets the same three-dot menu; what is in it depends on the ticket status.
const TicketActions = ({
  ticket: t,
  loading,
  pastGameDay,
  onAction,
}: {
  ticket: TicketResponse;
  loading: boolean;
  pastGameDay: boolean;
  onAction: (kind: TicketAction, ticket: TicketResponse) => void;
}) => {
  // Past game days keep the actions listed but inert, with the reason shown.
  const blocked = loading || pastGameDay;
  const hint = pastGameDay ? "Game day has passed" : undefined;

  const actions: RowAction[] =
    t.status === "PAID"
      ? [
          {
            label: "Check In",
            icon: CheckCircleIcon,
            disabled: blocked,
            hint,
            onSelect: () => onAction("checkin", t),
          },
        ]
      : t.status === "PENDING"
        ? [
            {
              label: "Verify payment",
              icon: ShieldCheckIcon,
              disabled: blocked,
              hint: hint ?? "Checks the payment with Paystack",
              onSelect: () => onAction("verify", t),
            },
            {
              label: "Force check-in",
              icon: BoltIcon,
              danger: true,
              disabled: blocked,
              hint: hint ?? "Verifies payment first, then checks in",
              onSelect: () => onAction("force", t),
            },
          ]
        : t.status === "USED"
          ? [
              {
                label: "Checked in",
                icon: CheckBadgeIcon,
                disabled: true,
                hint: "This ticket has already been used.",
              },
            ]
          : [
              {
                label: "No actions",
                icon: CheckBadgeIcon,
                disabled: true,
                hint: `This ticket is ${t.status.toLowerCase()}.`,
              },
            ];

  return (
    <RowActions
      label={`Actions for ticket ${t.ticket_code || t.email}`}
      actions={actions}
    />
  );
};

export const AdminTickets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Only admins can list past game days; ticketers get the public list,
  // which holds upcoming days only.
  const isAdmin = user?.role === "admin" || user?.role === "app_admin";
  const [page, setPage] = useState(1);
  // null until the user picks one; "" means all game days (admins only).
  const [filterEventDay, setFilterEventDay] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const { data: eventDaysData, isLoading: loadingEventDays } = useQuery({
    queryKey: ["adminTicketEventDays", isAdmin],
    queryFn: () => (isAdmin ? getAllEventDays() : getEventDays()),
  });

  const today = lagosToday();
  const { upcoming, past, eventDayById } = useMemo(() => {
    const all = eventDaysData ?? [];
    return {
      upcoming: all
        .filter((ed) => ed.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
      past: all
        .filter((ed) => ed.date < today)
        .sort((a, b) => b.date.localeCompare(a.date)),
      eventDayById: new Map(all.map((ed) => [ed.id, ed])),
    };
  }, [eventDaysData, today]);

  // Default to the next game day, or the most recent one if none are left.
  const selectedEventDay =
    filterEventDay ?? upcoming[0]?.id ?? past[0]?.id ?? "";

  const { data: ticketsData, isLoading: loadingTickets } = useQuery({
    queryKey: [
      "adminTickets",
      { page, eventDay: selectedEventDay, status: filterStatus },
    ],
    queryFn: () =>
      adminListTickets(
        page,
        10,
        selectedEventDay || undefined,
        filterStatus || undefined,
      ),
    // Wait for the default game day, rather than fetching every ticket first.
    enabled: !loadingEventDays,
  });

  const tickets = ticketsData?.data ?? NO_TICKETS;
  const totalPages = ticketsData?.total_pages || 1;
  const loading = loadingEventDays || loadingTickets;

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"code" | "email">("code");
  const [searchResults, setSearchResults] = useState<TicketResponse[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: TicketAction;
    ticket: TicketResponse;
  } | null>(null);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError("");
    setSearchResults([]);
    setSearching(true);

    try {
      if (searchMode === "code") {
        const result = await lookupTicketByCode(q.toUpperCase());
        setSearchResults([result]);
      } else {
        const results = await searchTicketsByEmail(q);
        if (results.length === 0) {
          setSearchError("No tickets found for this email.");
        } else {
          setSearchResults(results);
        }
      }
    } catch {
      setSearchError(
        searchMode === "code"
          ? "Ticket not found."
          : "No tickets found for this email.",
      );
    } finally {
      setSearching(false);
    }
  };

  // Verify a PENDING ticket via Paystack
  const handleVerify = async (ticket: TicketResponse) => {
    if (!ticket.paystack_reference) {
      toast.error("No Paystack reference found for this ticket.");
      return;
    }
    setActionLoading(ticket.id);
    try {
      const updated = await verifyTicket(ticket.paystack_reference);
      // Update in search results
      setSearchResults((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, status: updated.status } : t,
        ),
      );
      // Trigger table refetch
      queryClient.invalidateQueries({ queryKey: ["adminTickets"] });

      if (updated.status === "PAID") {
        toast.success("Payment verified. Ticket is now PAID.");
      } else {
        toast(`Payment status: ${updated.status}`);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Verification failed"));
    } finally {
      setActionLoading(null);
    }
  };

  // Regular check-in (PAID → USED)
  const handleCheckin = async (ticketId: string) => {
    if (!user) return;
    setActionLoading(ticketId);
    try {
      await checkinTicket(ticketId, user.name || user.email);
      setSearchResults((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: "USED" } : t)),
      );
      queryClient.invalidateQueries({ queryKey: ["adminTickets"] });
      toast.success("Ticket checked in.");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Check-in failed"));
    } finally {
      setActionLoading(null);
    }
  };

  // Admin force check-in (any status → USED)
  const handleAdminCheckin = async (ticketId: string) => {
    if (!user) return;
    setActionLoading(ticketId);
    try {
      await adminCheckinTicket(ticketId, user.name || user.email);
      setSearchResults((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: "USED" } : t)),
      );
      queryClient.invalidateQueries({ queryKey: ["adminTickets"] });
      toast.success("Ticket checked in.");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Check-in failed"));
    } finally {
      setActionLoading(null);
    }
  };

  // Runs once the user confirms. The handlers report their own errors, so the
  // dialog always closes afterwards.
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { kind, ticket } = pendingAction;
    if (kind === "verify") await handleVerify(ticket);
    else if (kind === "checkin") await handleCheckin(ticket.id);
    else await handleAdminCheckin(ticket.id);
    setPendingAction(null);
  };

  // One column list drives both tables (search results and the main list).
  const ticketColumns = useMemo<Column<TicketResponse>[]>(
    () => [
      {
        header: "Code",
        cell: (t) => (
          <span className="font-mono font-bold text-sffl-navy dark:text-white">
            {t.ticket_code || "—"}
          </span>
        ),
      },
      { header: "Event", cell: (t) => t.event_title || "—" },
      { header: "Tier", cell: (t) => t.tier_name || "—" },
      { header: "Name", cell: (t) => t.name || "—" },
      { header: "Email", cell: (t) => t.email },
      {
        header: "Phone",
        cell: (t) => t.phone || "—",
        className:
          "px-4 py-3 text-sm text-gray-900 dark:text-gray-300 whitespace-nowrap",
      },
      { header: "Qty", align: "center", cell: (t) => t.quantity },
      {
        header: "Amount",
        align: "right",
        cell: (t) => (
          <span className="font-semibold dark:text-white">
            ₦{t.total_amount?.toLocaleString()}
          </span>
        ),
      },
      {
        header: "Status",
        align: "center",
        cell: (t) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}
          >
            {t.status}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (t) => (
          <TicketActions
            ticket={t}
            loading={actionLoading === t.id}
            pastGameDay={isPastGameDay(t, eventDayById, today)}
            onAction={(kind, ticket) => setPendingAction({ kind, ticket })}
          />
        ),
      },
    ],
    [actionLoading, eventDayById, today],
  );

  const action = pendingAction ? ACTIONS[pendingAction.kind] : null;

  const filterSelectClass =
    "w-full sm:w-auto max-w-full px-3 py-2 min-h-11 border text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Tickets"
        subtitle="Search and check in tickets, and review ticket sales."
      />

      {/* ── Search / Check-in Section ─────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="flex items-center gap-2 text-lg font-bold text-sffl-navy dark:text-white mb-4">
          <MagnifyingGlassIcon className="w-5 h-5" aria-hidden="true" />
          Ticket Search & Check-in
        </h2>

        {/* Search Mode Toggle */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => {
              setSearchMode("code");
              setSearchQuery("");
              setSearchResults([]);
              setSearchError("");
            }}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === "code" ? "bg-sffl-navy text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
          >
            <HashtagIcon className="w-4 h-4" aria-hidden="true" />
            Search by Code
          </button>
          <button
            onClick={() => {
              setSearchMode("email");
              setSearchQuery("");
              setSearchResults([]);
              setSearchError("");
            }}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === "email" ? "bg-sffl-navy text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
          >
            <EnvelopeIcon className="w-4 h-4" aria-hidden="true" />
            Search by Email
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-0">
            <input
              type={searchMode === "email" ? "email" : "text"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                searchMode === "code"
                  ? "Enter ticket code (e.g. SFFL-A3K9X2)"
                  : "Enter email address"
              }
              className={`w-full pl-3 pr-10 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none ${searchMode === "code" ? "uppercase" : ""}`}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-0 top-0 h-full min-w-11 px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="inline-flex items-center justify-center gap-1.5 bg-sffl-navy text-white text-xs px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md font-bold hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {searching && (
              <ArrowPathIcon
                className="w-4 h-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {searching ? "Searching" : "Search"}
          </button>
        </div>

        {searchError && (
          <p className="flex items-center gap-1.5 text-red-500 text-sm mt-3 font-medium">
            <ExclamationCircleIcon
              className="w-4 h-4 shrink-0"
              aria-hidden="true"
            />
            {searchError}
          </p>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">
              {searchResults.length} ticket{searchResults.length > 1 ? "s" : ""}{" "}
              found
            </h3>
            <DataTable
              data={searchResults}
              columns={ticketColumns}
              searchable={false}
              paginated={false}
              getRowId={(t) => t.id}
            />
          </div>
        )}
      </div>

      {/* ── All Tickets Table ─────────────────────────────────────────── */}
      <DataTable
        data={tickets}
        columns={ticketColumns}
        searchable={false}
        serverPage={page}
        totalServerPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        getRowId={(t) => t.id}
        emptyMessage="No tickets found"
        headerActions={
          <>
            <select
              value={selectedEventDay}
              onChange={(e) => {
                setFilterEventDay(e.target.value);
                setPage(1);
              }}
              aria-label="Game day"
              className={filterSelectClass}
            >
              {isAdmin && <option value="">All game days</option>}
              {upcoming.length > 0 && (
                <optgroup label="Upcoming">
                  {upcoming.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {eventDayLabel(ed)}
                    </option>
                  ))}
                </optgroup>
              )}
              {past.length > 0 && (
                <optgroup label="Past">
                  {past.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {eventDayLabel(ed)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Ticket status"
              className={filterSelectClass}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="USED">Used</option>
              <option value="FAILED">Failed</option>
            </select>
          </>
        }
      />

      <ConfirmDialog
        open={pendingAction !== null}
        title={action?.title ?? ""}
        description={action?.description}
        confirmLabel={action?.confirmLabel ?? ""}
        tone={action?.tone}
        icon={action?.icon}
        pending={
          pendingAction !== null && actionLoading === pendingAction.ticket.id
        }
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
        body={
          pendingAction && (
            <TicketSummary
              t={pendingAction.ticket}
              showReference={pendingAction.kind === "verify"}
            />
          )
        }
      />
    </div>
  );
};
