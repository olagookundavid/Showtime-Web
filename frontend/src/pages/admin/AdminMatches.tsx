import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getMatches,
  getCompetitions,
  getTeams,
  getTeamsByCompetition,
  createMatch,
  updateMatch,
  deleteMatch,
  getAdminTeamSheet,
  type Match,
  type Competition,
  type Team,
  type CreateMatchPayload,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { AdminTeamSheetModal } from "../../components/admin/AdminTeamSheetModal";
import { AdminKnockoutBracket } from "../../components/admin/AdminKnockoutBracket";
import { KNOCKOUT_STAGES } from "../../components/matches/BracketView";
import { formatMatchDate, formatMatchTime } from "../../utils/dateUtils";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

interface FormData {
  competition_id: string;
  home_team_id: string;
  away_team_id: string;
  date: string;
  start_time: string;
  venue: string;
  status: string;
  home_score: string;
  away_score: string;
  highlights_url: string;
  ticket_url: string;
  round: string;
  bracket_pos: string;
  feeds_match_id: string;
  feeds_slot: string;
  second_leg_match_id: string;
  mvp_player_id: string;
}

const emptyForm: FormData = {
  competition_id: "",
  home_team_id: "",
  away_team_id: "",
  date: "",
  start_time: "12:00",
  venue: "Showtime Arena",
  status: "FINISHED",
  home_score: "",
  away_score: "",
  highlights_url: "",
  ticket_url: "",
  round: "",
  bracket_pos: "",
  feeds_match_id: "",
  feeds_slot: "HOME",
  second_leg_match_id: "",
  mvp_player_id: "",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  LIVE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  FINISHED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  POSTPONED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

// A stable empty list, so the tables aren't handed a fresh array on every render.
const NO_MATCHES: Match[] = [];

// Every save and delete goes through the confirm dialog first.
type PendingAction = { kind: "save" } | { kind: "delete"; match: Match };

type MatchWithTeamIds = Match & {
  competition_id?: string;
  home_team_id?: string;
  away_team_id?: string;
};

const formatSummaryDate = (date: string) =>
  formatMatchDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// What the confirm dialog names as the record affected.
const MatchSummary = ({
  home,
  away,
  date,
  time,
  status,
  score,
}: {
  home: string;
  away: string;
  date: string;
  time: string;
  status: string;
  score?: string;
}) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
    <dt className="text-gray-500 dark:text-gray-400">Match</dt>
    <dd className="min-w-0 wrap-break-word font-bold uppercase text-sffl-navy dark:text-white">
      {home} vs {away}
    </dd>
    <dt className="text-gray-500 dark:text-gray-400">Date</dt>
    <dd className="dark:text-white">
      {date
        ? `${formatSummaryDate(date)} · ${formatMatchTime(time, date)}`
        : "—"}
    </dd>
    <dt className="text-gray-500 dark:text-gray-400">Status</dt>
    <dd className="dark:text-white">{status}</dd>
    {score && (
      <>
        <dt className="text-gray-500 dark:text-gray-400">Score</dt>
        <dd className="font-bold dark:text-white">{score}</dd>
      </>
    )}
  </dl>
);

// Fantasy runs off this calendar: a gameweek is one date the competition
// plays on. Removing the last fixture on a day removes the day, and with it
// the gameweek, so the warning has to be louder for that case than for
// deleting one of several.
const FantasyDeleteWarning = ({
  match,
  matches,
}: {
  match: Match;
  matches: Match[];
}) => {
  const sameDay = matches.filter((m) => m.date === match.date);
  const isLastOnDay = sameDay.length <= 1;
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        isLastOnDay
          ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
          : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
      }`}
    >
      <p className="font-black uppercase tracking-wider mb-1">
        {isLastOnDay
          ? "This also deletes a fantasy gameweek"
          : "Affects fantasy"}
      </p>
      {isLastOnDay ? (
        <p>
          It is the only fixture on this date, so the match day disappears and
          its fantasy gameweek is removed with it. If managers have already
          scored on that gameweek their points go too — that gameweek is kept
          instead, and you will be told. Either way the remaining gameweeks are
          renumbered.
        </p>
      ) : (
        <p>
          {sameDay.length - 1} other{" "}
          {sameDay.length - 1 === 1 ? "fixture" : "fixtures"} remain on this
          date, so the fantasy gameweek stays. Its lock time may shift if this
          was the earliest kickoff.
        </p>
      )}
    </div>
  );
};

export const AdminMatches = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [teamSheetMatch, setTeamSheetMatch] = useState<Match | null>(null);

  // Filters
  const [filterComp, setFilterComp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: compsData, isLoading: loadingComps } = useQuery({
    queryKey: ["adminCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });

  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ["adminTeamsList"],
    queryFn: () => getTeams(1, 100),
  });

  // Knockout comps swap the date-grouped table for the bracket builder,
  // which needs the whole bracket at once (no pagination).
  const isKnockout =
    (compsData?.data || []).find((c) => c.id === filterComp)?.format ===
    "PLAYOFFS";

  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: [
      "adminMatches",
      { comp: filterComp, page, search: searchTerm, knockout: isKnockout },
    ],
    queryFn: async () => {
      const data = await getMatches(
        filterComp || undefined,
        isKnockout ? 1 : page,
        isKnockout ? 100 : PAGE_SIZE,
        undefined,
        isKnockout ? undefined : searchTerm,
      );
      return Array.isArray(data) ? { data, total_pages: 1 } : data;
    },
  });

  // All matches of the form's competition, for the "winner advances to" picker.
  const { data: bracketMatchesData } = useQuery({
    queryKey: ["bracketTargets", form.competition_id],
    queryFn: () => getMatches(form.competition_id, 1, 100),
    enabled: showModal && !!form.competition_id,
  });

  // Team sheet for the match being edited (for MVP selection)
  const { data: editTeamSheet } = useQuery({
    queryKey: ["adminMatchTeamSheet", editingId],
    queryFn: () => getAdminTeamSheet(editingId!),
    enabled: showModal && !!editingId,
  });

  // Auto-select first competition when loaded
  useEffect(() => {
    const comps = (compsData?.data || []).filter(
      (c) => c.status !== "inactive",
    );
    if (comps.length > 0 && !filterComp) {
      setFilterComp(comps[0].id);
    }
  }, [compsData, filterComp]);

  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>(
    {},
  );

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const competitions: Competition[] = (compsData?.data || []).filter(
    (c) => c.status !== "inactive",
  );
  const selectedCompData = competitions.find((c) => c.id === filterComp);
  const isCompleted = selectedCompData?.status === "completed";
  const formComp = (compsData?.data || []).find(
    (c) => c.id === form.competition_id,
  );
  const formIsKnockout = formComp?.format === "PLAYOFFS";
  const bracketTargets: Match[] = (bracketMatchesData?.data || []).filter(
    (m) => m.id !== editingId,
  );

  // teams must be declared FIRST — compScopedTeams and activeTeamsForForm depend on it.
  const teams: Team[] = (teamsData?.data || []).filter(
    (t: Team) => t.status !== "inactive",
  );
  const matches: Match[] = matchesData?.data ?? NO_MATCHES;
  const totalPages = matchesData?.total_pages || 1;
  const loading = loadingComps || loadingTeams || loadingMatches;

  // Scope the team picker to competition-enrolled teams so only valid teams appear.
  // Falls back to all teams if the competition has no enrolled teams yet.
  const { data: compScopedTeamsData } = useQuery({
    queryKey: ["adminCompScopedTeams", form.competition_id],
    queryFn: () => getTeamsByCompetition(form.competition_id),
    enabled: !!form.competition_id,
  });
  const compScopedTeams: Team[] = (
    Array.isArray(compScopedTeamsData?.data)
      ? compScopedTeamsData.data
      : Array.isArray(compScopedTeamsData)
        ? compScopedTeamsData
        : []
  ).filter((t: Team) => t.status !== "inactive");
  const activeTeamsForForm =
    form.competition_id && compScopedTeams.length > 0 ? compScopedTeams : teams;
  const selectableTeams = (): Team[] => activeTeamsForForm;

  const groupedMatches = useMemo(
    () =>
      matches.reduce((acc: Record<string, Match[]>, match: Match) => {
        const dateStr = match.date.substring(0, 10);
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(match);
        return acc;
      }, {}),
    [matches],
  );

  const handleFilterChange = (compId: string) => {
    setFilterComp(compId);
    setPage(1);
  };

  const openCreate = (round?: string) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      competition_id: filterComp,
      round: round || "",
    });
    setShowModal(true);
  };

  // Stable between renders (the query data only changes on refetch), so the
  // table columns below can be memoized.
  const openEdit = useCallback(
    (m: Match) => {
      console.log("Editing match:", m);
      setEditingId(m.id);

      const matchWithTeamIds = m as MatchWithTeamIds;

      const activeTeams = (teamsData?.data || []).filter(
        (t: Team) => t.status !== "inactive",
      );

      const compId =
        m.competition?.id ||
        matchWithTeamIds.competition_id ||
        (compsData?.data || []).find((c) => c.name === m.competition?.name)
          ?.id ||
        "";

      const homeId =
        m.home_team?.id ||
        matchWithTeamIds.home_team_id ||
        activeTeams.find((t) => t.name === m.home_team?.name)?.id ||
        "";

      const isBye =
        m.status === "FINISHED" &&
        ((m.home_team?.id && !m.away_team?.id) ||
          (!m.home_team?.id && m.away_team?.id));
      const awayId = isBye
        ? "BYE"
        : m.away_team?.id ||
          matchWithTeamIds.away_team_id ||
          activeTeams.find((t) => t.name === m.away_team?.name)?.id ||
          "";

      // Robust time parsing
      let displayTime = m.start_time || "";
      if (displayTime.includes("T")) {
        // It's a full ISO string
        displayTime = displayTime.split("T")[1].slice(0, 5);
      }
      if (displayTime === "00:00:00" || displayTime === "00:00") {
        displayTime = "";
      }

      setForm({
        competition_id: compId,
        home_team_id: homeId,
        away_team_id: awayId,
        date: m.date ? m.date.slice(0, 10) : "",
        start_time: displayTime,
        venue: m.venue || "",
        status: m.status,
        home_score: m.home_score?.toString() ?? "",
        away_score: m.away_score?.toString() ?? "",
        highlights_url: m.highlights_url || "",
        ticket_url: m.ticket_url || "",
        round: m.round || "",
        bracket_pos: m.bracket_pos?.toString() ?? "",
        feeds_match_id: m.feeds_match_id || "",
        feeds_slot: m.feeds_slot || "HOME",
        second_leg_match_id: m.second_leg_match_id || "",
        mvp_player_id: m.mvp_player_id || "",
      });
      setShowModal(true);
    },
    [compsData, teamsData],
  );

  // Runs before the confirm dialog opens, so it never asks about a form that can't be saved.
  const validateForm = () => {
    const isBye =
      formIsKnockout &&
      (form.away_team_id === "BYE" ||
        (form.home_team_id &&
          !form.away_team_id &&
          form.status === "FINISHED"));
    if (
      form.status === "FINISHED" &&
      !isBye &&
      (form.home_score === "" || form.away_score === "")
    ) {
      toast.error("Home and Away scores are required for finished matches");
      return false;
    }
    if (!formIsKnockout && (!form.home_team_id || !form.away_team_id)) {
      toast.error("Home and Away teams are required");
      return false;
    }
    if (formIsKnockout && !form.round) {
      toast.error("Pick the stage (Wildcard, Playoff 1, Playoff 2 or Bowl)");
      return false;
    }
    return true;
  };

  const requestSave = () => {
    if (validateForm()) setPendingAction({ kind: "save" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveAwayId = form.away_team_id === "BYE" ? "" : form.away_team_id;
      const saveStatus = form.away_team_id === "BYE" ? "FINISHED" : form.status;
      const saveHomeScore =
        form.away_team_id === "BYE"
          ? null
          : form.home_score !== ""
            ? parseInt(form.home_score)
            : null;
      const saveAwayScore =
        form.away_team_id === "BYE"
          ? null
          : form.away_score !== ""
            ? parseInt(form.away_score)
            : null;

      const payload: CreateMatchPayload = {
        competition_id: form.competition_id,
        home_team_id: form.home_team_id,
        away_team_id: saveAwayId,
        date: form.date,
        start_time: form.start_time,
        venue: form.venue,
        status: saveStatus,
        home_score: saveHomeScore,
        away_score: saveAwayScore,
        highlights_url: form.highlights_url,
        ticket_url: form.ticket_url,
        round: formIsKnockout ? form.round : undefined,
        bracket_pos:
          formIsKnockout && form.bracket_pos !== ""
            ? parseInt(form.bracket_pos)
            : null,
        feeds_match_id:
          formIsKnockout && form.feeds_match_id ? form.feeds_match_id : null,
        feeds_slot:
          formIsKnockout && form.feeds_match_id ? form.feeds_slot : undefined,
        second_leg_match_id:
          formIsKnockout && form.second_leg_match_id
            ? form.second_leg_match_id
            : null,
        // '' clears the MVP; the API treats an omitted/null field as "keep".
        mvp_player_id: form.mvp_player_id || "",
      };
      if (editingId) {
        await updateMatch(editingId, payload);
        toast.success("Match updated successfully");
      } else {
        await createMatch(payload);
        toast.success("Match created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["adminMatches"] });
      setShowModal(false);
    } catch (err: unknown) {
      console.error(err);
      const errorData =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string; error?: string } };
              }
            ).response?.data
          : undefined;
      toast.error(
        errorData?.message || errorData?.error || "Failed to save match",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteMatch(id);
      queryClient.invalidateQueries({ queryKey: ["adminMatches"] });
      toast.success("Match deleted successfully");
    } catch (err: unknown) {
      console.error(err);
      const errorData =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { message?: string; error?: string } };
              }
            ).response?.data
          : undefined;
      toast.error(
        errorData?.message ||
          errorData?.error ||
          "Failed to delete match",
      );
    } finally {
      setDeleting(false);
    }
  };

  // Runs once the user confirms. The handlers report their own errors, so the
  // dialog always closes afterwards (a failed save leaves the form open).
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "save") await handleSave();
    else await handleDelete(pendingAction.match.id);
    setPendingAction(null);
  };

  const set = (field: keyof FormData, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  // One column list drives every date group's table. Match leads because the first
  // column stays frozen when the table scrolls sideways.
  const matchColumns = useMemo<Column<Match>[]>(
    () => [
      {
        header: "Match",
        cell: (m) => (
          <span className="font-bold text-gray-900 dark:text-gray-100 uppercase">
            {m.home_team?.short_name || "TBD"} vs{" "}
            {m.away_team?.short_name || "TBD"}
            {m.round && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200 text-[10px] font-bold tracking-wide normal-case">
                {m.round}
              </span>
            )}
            {m.second_leg_match_id && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-[10px] font-bold tracking-wide normal-case">
                2L
              </span>
            )}
          </span>
        ),
      },
      {
        header: "Kick-off",
        cell: (m) => (
          <span className="whitespace-nowrap font-medium text-gray-600 dark:text-gray-300">
            {formatMatchTime(m.start_time, m.date)}
          </span>
        ),
      },
      {
        header: "Score",
        cell: (m) => (
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {m.status === "FINISHED"
              ? `${m.home_score} - ${m.away_score}`
              : "—"}
          </span>
        ),
      },
      {
        header: "Status",
        cell: (m) => (
          <span
            className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wide ${STATUS_COLORS[m.status] || "bg-gray-100 min-w-16 dark:bg-gray-600 dark:text-gray-300"}`}
          >
            {m.status}
          </span>
        ),
      },
      {
        header: "Competition",
        cell: (m) => (
          <span className="text-gray-600 dark:text-gray-300">
            {m.competition?.name || "—"}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (m) => {
          const locked = isCompleted ? "Competition is completed" : undefined;
          return (
            <RowActions
              label={`Actions for ${m.home_team?.short_name || "TBD"} vs ${m.away_team?.short_name || "TBD"}`}
              actions={[
                {
                  label: "Team Sheet",
                  icon: ClipboardDocumentListIcon,
                  disabled: isCompleted,
                  hint: locked,
                  onSelect: () => setTeamSheetMatch(m),
                },
                {
                  label: "Edit",
                  icon: PencilSquareIcon,
                  disabled: isCompleted,
                  hint: locked,
                  onSelect: () => openEdit(m),
                },
                {
                  label: "Delete",
                  icon: TrashIcon,
                  danger: true,
                  disabled: isCompleted,
                  hint: locked,
                  onSelect: () => setPendingAction({ kind: "delete", match: m }),
                },
              ]}
            />
          );
        },
      },
    ],
    [isCompleted, openEdit],
  );

  // Names for the save dialog. The comp-scoped list is tried first, then every team.
  const teamName = (id: string) => {
    if (id === "BYE") return "BYE";
    return (
      (
        activeTeamsForForm.find((t) => t.id === id) ||
        (teamsData?.data || []).find((t) => t.id === id)
      )?.name || "TBD"
    );
  };

  const dialog =
    pendingAction?.kind === "delete"
      ? {
          title: "Delete this match?",
          description: "This cannot be undone.",
          confirmLabel: "Delete Match",
          tone: "warning" as const,
          icon: TrashIcon,
        }
      : editingId
        ? {
            title: "Save changes to this match?",
            description: undefined,
            confirmLabel: "Save Changes",
            tone: "info" as const,
            icon: PencilSquareIcon,
          }
        : {
            title: "Create this match?",
            description: undefined,
            confirmLabel: "Create Match",
            tone: "info" as const,
            icon: CheckCircleIcon,
          };

  const inputClass =
    "w-full min-h-11 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Matches"
        subtitle="Schedule fixtures, enter scores and manage results for each competition."
        actions={
          <button
            type="button"
            onClick={() => openCreate()}
            disabled={isCompleted}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-4 h-4" aria-hidden="true" />
            Add Match
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        {!isKnockout && (
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-auto">
            <input
              type="text"
              aria-label="Search matches"
              placeholder="Search matches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-11 z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </form>
        )}
        {isKnockout && (
          <span className="self-start sm:self-auto px-2.5 py-1.5 rounded-lg bg-sffl-navy/10 text-sffl-navy dark:bg-gray-700 dark:text-gray-200 text-xs font-black uppercase tracking-wider">
            Knockout Bracket
          </span>
        )}
        <select
          aria-label="Competition"
          value={filterComp}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="w-full sm:w-auto max-w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-11 z-50 font-semibold text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {competitions.map((c) => (
            <option key={c.id} value={c.id} className="truncate">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isCompleted && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-400 font-bold text-sm">
          <LockClosedIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>
            Season Completed. Matches are locked and cannot be modified.
          </span>
        </div>
      )}

      {loading ? (
        <Loader />
      ) : isKnockout ? (
        <AdminKnockoutBracket
          competitionId={filterComp}
          matches={matches}
          isCompleted={isCompleted}
          onAdd={(stage?: string) => openCreate(stage)}
          onEdit={openEdit}
          onDelete={(m) => setPendingAction({ kind: "delete", match: m })}
          onTeamSheet={(m) => setTeamSheetMatch(m)}
        />
      ) : matches.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-xl text-center shadow-sm">
          <p className="text-gray-500 font-semibold mb-2">No matches found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMatches).map(([dateStr, dayMatches]) => {
            const collapsed = !!collapsedDates[dateStr];
            return (
              <section key={dateStr} className="space-y-3">
                <button
                  type="button"
                  onClick={() => toggleDateCollapse(dateStr)}
                  aria-expanded={!collapsed}
                  className="w-full flex items-center justify-between gap-3 p-3 sm:p-4 min-h-11 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-gray-500 dark:text-gray-400 text-base sm:text-lg">
                      {new Date(dateStr).getFullYear()}
                    </span>
                    <div className="shrink-0 bg-sffl-navy text-white w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold">
                      <span className="text-xs tracking-wider uppercase">
                        {new Date(dateStr).toLocaleString("default", {
                          month: "short",
                        })}
                      </span>
                      <span className="text-sm leading-none">
                        {new Date(dateStr).getDate()}
                      </span>
                    </div>
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-base sm:text-lg truncate">
                      {new Date(dateStr).toLocaleDateString("default", {
                        weekday: "long",
                      })}
                    </span>
                  </div>
                  <div className="shrink-0 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                    <ChevronDownIcon
                      className={`w-5 h-5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>

                {!collapsed && (
                  <DataTable
                    data={dayMatches}
                    columns={matchColumns}
                    searchable={false}
                    paginated={false}
                    getRowId={(m) => m.id}
                  />
                )}
              </section>
            );
          })}

          {/* Pagination spans every date group, so it lives here rather than in the tables */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 mt-6 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                {editingId ? "Edit Match" : "Add Match"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Competition *
                  </label>
                  <select
                    value={form.competition_id}
                    onChange={(e) => set("competition_id", e.target.value)}
                    className={`${inputClass} z-50 outline-none focus:ring-2 focus:ring-sffl-red`}
                  >
                    <option value="" className="truncate">
                      Select...
                    </option>
                    {(compsData?.data || [])
                      .filter(
                        (c) =>
                          c.status !== "inactive" ||
                          c.id === form.competition_id,
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id} className="truncate">
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={`${inputClass} z-50`}
                  >
                    {["SCHEDULED", "LIVE", "FINISHED", "POSTPONED"].map((s) => (
                      <option key={s} value={s} className="truncate">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {formIsKnockout ? "Home Team" : "Home Team *"}
                  </label>
                  <select
                    value={form.home_team_id}
                    onChange={(e) => set("home_team_id", e.target.value)}
                    className={`${inputClass} z-50`}
                  >
                    <option value="" className="truncate">
                      {formIsKnockout ? "TBD — filled by bracket" : "Select..."}
                    </option>
                    {selectableTeams().map((t) => (
                      <option key={t.id} value={t.id} className="truncate">
                        {t.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {formIsKnockout ? "Away Team" : "Away Team *"}
                  </label>
                  <select
                    value={form.away_team_id}
                    onChange={(e) => set("away_team_id", e.target.value)}
                    className={`${inputClass} z-50`}
                  >
                    <option value="" className="truncate">
                      {formIsKnockout ? "TBD — filled by bracket" : "Select..."}
                    </option>
                    {formIsKnockout && (
                      <option value="BYE">BYE (PLAYOFF BYE)</option>
                    )}
                    {selectableTeams().map((t) => (
                      <option key={t.id} value={t.id} className="truncate">
                        {t.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formIsKnockout && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-black text-sffl-navy dark:text-gray-200 uppercase tracking-widest">
                    Bracket Setup
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Stage *
                      </label>
                      <select
                        value={form.round}
                        onChange={(e) => set("round", e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select stage…</option>
                        {KNOCKOUT_STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Order in Stage
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.bracket_pos}
                        onChange={(e) => set("bracket_pos", e.target.value)}
                        className={inputClass}
                        placeholder="1 = top of the column"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Second Leg Match (Optional)
                    </label>
                    <select
                      value={form.second_leg_match_id}
                      onChange={(e) =>
                        set("second_leg_match_id", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">None</option>
                      {bracketTargets.map((m) => (
                        <option key={m.id} value={m.id} className="truncate">
                          {(m.round ? `${m.round}: ` : "") +
                            (m.home_team?.short_name || "TBD") +
                            " vs " +
                            (m.away_team?.short_name || "TBD") +
                            ` (${m.date.substring(0, 10)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer py-3.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Auto-advance (optional — for live brackets)
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Winner Advances To
                        </label>
                        <select
                          value={form.feeds_match_id}
                          onChange={(e) =>
                            set("feeds_match_id", e.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="">None</option>
                          {bracketTargets.map((m) => (
                            <option
                              key={m.id}
                              value={m.id}
                              className="truncate"
                            >
                              {(m.round ? `${m.round}: ` : "") +
                                (m.home_team?.short_name || "TBD") +
                                " vs " +
                                (m.away_team?.short_name || "TBD") +
                                ` (${m.date.substring(0, 10)})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div
                        className={
                          form.feeds_match_id
                            ? ""
                            : "opacity-40 pointer-events-none"
                        }
                      >
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                          As
                        </label>
                        <select
                          value={form.feeds_slot}
                          onChange={(e) => set("feeds_slot", e.target.value)}
                          className={inputClass}
                        >
                          <option value="HOME">Home team</option>
                          <option value="AWAY">Away team</option>
                        </select>
                      </div>
                    </div>
                  </details>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Pick the stage and set Home/Away yourself. The bracket
                    arranges matches by stage — a two-legged tie is just two
                    matches tagged the same stage. Auto-advance is only needed
                    for live single-leg brackets.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Kick-off Time
                  </label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => set("start_time", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => set("venue", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. SFFL Arena"
                  />
                </div>
              </div>

              {/* The routine edit. Moving a kickoff is safe but it
                                does move the fantasy deadline, and moving a date
                                moves the whole gameweek — worth saying before
                                the save, not after. */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                <p className="font-black uppercase tracking-wider mb-1">
                  Fantasy follows this
                </p>
                <p>
                  Changing the <strong>kick-off</strong> moves this match day's
                  fantasy lock time if it is the earliest game of the day.
                  Changing the <strong>date</strong> moves the fantasy gameweek
                  to the new day and renumbers the rest. Gameweeks already
                  played keep their number and are never moved.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Home Score
                  </label>
                  <input
                    type="number"
                    value={form.home_score}
                    onChange={(e) => set("home_score", e.target.value)}
                    className={inputClass}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Away Score
                  </label>
                  <input
                    type="number"
                    value={form.away_score}
                    onChange={(e) => set("away_score", e.target.value)}
                    className={inputClass}
                    min="0"
                  />
                </div>
              </div>

              {/* Match MVP Selection / Override */}
              {editingId && (
                <div className="p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sffl-navy dark:text-gray-200">
                      <TrophyIcon
                        className="w-4 h-4 shrink-0"
                        aria-hidden="true"
                      />
                      Official Match MVP (Admin Override)
                    </label>
                    {form.mvp_player_id && (
                      <button
                        type="button"
                        onClick={() => set("mvp_player_id", "")}
                        className="min-h-11 px-2 text-xs text-sffl-red hover:underline font-bold"
                      >
                        Reset to Auto-Calculated
                      </button>
                    )}
                  </div>
                  <select
                    value={form.mvp_player_id}
                    onChange={(e) => set("mvp_player_id", e.target.value)}
                    className={`${inputClass} text-sm`}
                  >
                    <option value="">
                      Auto-Calculated by Platform (Default)
                    </option>
                    {editTeamSheet?.home_team &&
                      editTeamSheet.home_team.length > 0 && (
                        <optgroup label="Home Team Roster">
                          {editTeamSheet.home_team.map((p) => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_number} {p.name} ({p.position}){" "}
                              {p.rating
                                ? `· Rating ${p.rating.toFixed(1)}`
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    {editTeamSheet?.away_team &&
                      editTeamSheet.away_team.length > 0 && (
                        <optgroup label="Away Team Roster">
                          {editTeamSheet.away_team.map((p) => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_number} {p.name} ({p.position}){" "}
                              {p.rating
                                ? `· Rating ${p.rating.toFixed(1)}`
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                  </select>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                    Leave as "Auto-Calculated" for the system to award MVP
                    dynamically based on winning team and composite impact, or
                    choose a player to record an official override.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Highlights URL
                </label>
                <input
                  type="url"
                  value={form.highlights_url}
                  onChange={(e) => set("highlights_url", e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Ticket URL
                </label>
                <input
                  type="url"
                  value={form.ticket_url}
                  onChange={(e) => set("ticket_url", e.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestSave}
                disabled={saving}
                className="px-4 py-2 min-h-11 bg-sffl-red text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rendered outside the form overlay: portal clicks bubble through the
                React tree, so inside it a backdrop click would also close the form. */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        icon={dialog.icon}
        pending={saving || deleting}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
        body={
          pendingAction?.kind === "delete" ? (
            <div className="space-y-3">
              <MatchSummary
                home={pendingAction.match.home_team?.name || "TBD"}
                away={pendingAction.match.away_team?.name || "TBD"}
                date={pendingAction.match.date}
                time={pendingAction.match.start_time}
                status={pendingAction.match.status}
                score={
                  pendingAction.match.status === "FINISHED"
                    ? `${pendingAction.match.home_score} - ${pendingAction.match.away_score}`
                    : undefined
                }
              />
              <FantasyDeleteWarning
                match={pendingAction.match}
                matches={matches}
              />
            </div>
          ) : pendingAction?.kind === "save" ? (
            <MatchSummary
              home={teamName(form.home_team_id)}
              away={teamName(form.away_team_id)}
              date={form.date}
              time={form.start_time}
              status={form.away_team_id === "BYE" ? "FINISHED" : form.status}
              score={
                form.status === "FINISHED" &&
                form.away_team_id !== "BYE" &&
                form.home_score !== "" &&
                form.away_score !== ""
                  ? `${form.home_score} - ${form.away_score}`
                  : undefined
              }
            />
          ) : null
        }
      />

      {/* Team Sheet Modal */}
      {teamSheetMatch && (
        <AdminTeamSheetModal
          match={teamSheetMatch}
          onClose={() => setTeamSheetMatch(null)}
        />
      )}
    </div>
  );
};
