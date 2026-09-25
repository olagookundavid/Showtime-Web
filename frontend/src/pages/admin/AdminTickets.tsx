import { Loader } from "../../components/ui/Loader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  BoltIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

  const tickets: TicketResponse[] = ticketsData?.data ?? [];
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
  const isPastGameDay = (t: TicketResponse) => {
    const date = eventDayById.get(t.event_day_id)?.date ?? t.event_date;
    return !!date && !date.startsWith("0001") && date < today;
  };

  const ActionButtons = ({ t }: { t: TicketResponse }) => {
    const isLoading = actionLoading === t.id;
    const pastGameDay = isPastGameDay(t);
    const spinner = (
      <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
    );
    // Past game days keep the button visible but grayed out and inert.
    const buttonClass = (color: string) =>
      `inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 rounded-lg text-xs font-bold transition-all duration-300 ${
        pastGameDay
          ? "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
          : `${color} text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50`
      }`;
    const pastTitle = "Game day has passed";

    if (t.status === "USED") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-500 font-semibold">
          <CheckBadgeIcon className="w-4 h-4" aria-hidden="true" />
          Checked In
        </span>
      );
    }

    if (t.status === "PAID") {
      return (
        <button
          onClick={() => setPendingAction({ kind: "checkin", ticket: t })}
          disabled={isLoading || pastGameDay}
          className={buttonClass("bg-green-600 hover:bg-green-700")}
          title={pastGameDay ? pastTitle : undefined}
        >
          {isLoading ? (
            spinner
          ) : (
            <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />
          )}
          Check In
        </button>
      );
    }

    if (t.status === "PENDING") {
      return (
        <div className="flex justify-center gap-1.5">
          <button
            onClick={() => setPendingAction({ kind: "verify", ticket: t })}
            disabled={isLoading || pastGameDay}
            className={buttonClass(
              "bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md",
            )}
            title={pastGameDay ? pastTitle : "Verify payment with Paystack"}
          >
            {isLoading ? (
              spinner
            ) : (
              <ShieldCheckIcon className="w-4 h-4" aria-hidden="true" />
            )}
            Verify
          </button>
          <button
            onClick={() => setPendingAction({ kind: "force", ticket: t })}
            disabled={isLoading || pastGameDay}
            className={buttonClass(
              "bg-orange-600 hover:bg-orange-700 shadow-sm hover:shadow-md",
            )}
            title={
              pastGameDay
                ? pastTitle
                : "Force check-in (verifies payment first)"
            }
          >
            {isLoading ? (
              spinner
            ) : (
              <BoltIcon className="w-4 h-4" aria-hidden="true" />
            )}
            Force
          </button>
        </div>
      );
    }

    return <span className="text-xs text-gray-400">—</span>;
  };

  const action = pendingAction ? ACTIONS[pendingAction.kind] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black text-sffl-navy dark:text-white">
        Ticket Management
      </h1>

      {/* ── Search / Check-in Section ─────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="flex items-center gap-2 text-lg font-bold text-sffl-navy dark:text-white mb-4">
          <MagnifyingGlassIcon className="w-5 h-5" aria-hidden="true" />
          Ticket Search & Check-in
        </h2>

        {/* Search Mode Toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setSearchMode("code");
              setSearchQuery("");
              setSearchResults([]);
              setSearchError("");
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === "code" ? "bg-sffl-navy text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
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
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${searchMode === "email" ? "bg-sffl-navy text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
          >
            <EnvelopeIcon className="w-4 h-4" aria-hidden="true" />
            Search by Email
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-3">
          <div className="relative flex-1">
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
                className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="bg-sffl-navy text-white text-xs px-4 py-2 min-h-11 rounded-lg shadow-sm hover:shadow-md font-bold hover:bg-blue-900 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
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
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Event</th>
                    <th className="px-4 py-2 text-left">Tier</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {searchResults.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-sffl-navy dark:text-white text-sm">
                        {t.ticket_code || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.event_title || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.tier_name || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.name || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.email}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm whitespace-nowrap">
                        {t.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-center dark:text-gray-300">
                        {t.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold dark:text-white">
                        ₦{t.total_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ActionButtons t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── All Tickets Table ─────────────────────────────────────────── */}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={selectedEventDay}
          onChange={(e) => {
            setFilterEventDay(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 min-h-11 max-w-full z-50 border mb-2 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {isAdmin && <option value="">All game days</option>}
          {upcoming.length > 0 && (
            <optgroup label="Upcoming">
              {upcoming.map((ed) => (
                <option key={ed.id} value={ed.id} className="truncate">
                  {eventDayLabel(ed)}
                </option>
              ))}
            </optgroup>
          )}
          {past.length > 0 && (
            <optgroup label="Past">
              {past.map((ed) => (
                <option key={ed.id} value={ed.id} className="truncate">
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
          className="px-3 py-2 min-h-11 z-50 border mb-2 text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="" className="truncate">
            All Statuses
          </option>
          <option value="PENDING" className="truncate">
            Pending
          </option>
          <option value="PAID" className="truncate">
            Paid
          </option>
          <option value="USED" className="truncate">
            Used
          </option>
          <option value="FAILED" className="truncate">
            Failed
          </option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        {loading ? (
          <Loader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tickets.length > 0 ? (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-sffl-navy dark:text-white text-sm">
                        {t.ticket_code || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.event_title || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.tier_name || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.name || "—"}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm">
                        {t.email}
                      </td>
                      <td className="px-4 py-3 dark:text-gray-300 text-sm whitespace-nowrap">
                        {t.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-center dark:text-gray-300">
                        {t.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold dark:text-white">
                        ₦{t.total_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ActionButtons t={t} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      No tickets found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-4 py-2 min-h-11 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
              Prev
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-4 py-2 min-h-11 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              Next
              <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

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
