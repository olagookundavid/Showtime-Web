import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  EyeIcon,
  EyeSlashIcon,
  IdentificationIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  getAdminTeams,
  getManagerCandidates,
  getPlayers,
  type Team,
} from "../../services/api";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { LightboxImage } from "../../components/ui";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";
import {
  MANAGER_CANDIDATES_KEY,
  MAX_MAIN_SQUAD,
  useTeamActions,
} from "../../components/admin/useTeamActions";
import { TeamActionDialogs } from "../../components/admin/TeamActionDialogs";
import { TeamStatusBadge } from "../../components/admin/TeamStatusBadge";
import { getApiErrorMessage } from "../../utils/apiError";
import { isDeletedPlayer } from "../../components/common/DeletedPlayer";

const NO_TEAMS: Team[] = [];
const PAGE_SIZE = 20;
const STATUS_FILTERS = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type Squad = { main: number; reserves: number };

const AdminTeams = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const actions = useTeamActions();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["adminTeams", { page, limit: PAGE_SIZE, search, statusFilter }],
    queryFn: () =>
      getAdminTeams({
        page,
        limit: PAGE_SIZE,
        search,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });
  const teams = data?.data ?? NO_TEAMS;
  const totalPages = data?.total_pages || 1;

  // One call each for the whole table, rather than one per row.
  const { data: candidates } = useQuery({
    queryKey: MANAGER_CANDIDATES_KEY,
    queryFn: getManagerCandidates,
  });
  const { data: playersPage, isLoading: loadingPlayers } = useQuery({
    // Under adminPlayers, so edits on the Players page refresh the counts.
    queryKey: ["adminPlayers", "squadCounts"],
    queryFn: () => getPlayers(undefined, 1, 1000, undefined, "all"),
  });

  const headsByTeam = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of candidates ?? []) {
      if (!c.assigned_team_id) continue;
      const names = map.get(c.assigned_team_id) ?? [];
      names.push(c.full_name || c.email);
      map.set(c.assigned_team_id, names);
    }
    return map;
  }, [candidates]);

  const squadByTeam = useMemo(() => {
    const map = new Map<string, Squad>();
    for (const p of playersPage?.data ?? []) {
      const teamId = p.team?.id;
      if (!teamId || isDeletedPlayer(p)) continue;
      const squad = map.get(teamId) ?? { main: 0, reserves: 0 };
      if (p.is_reserve) squad.reserves++;
      else squad.main++;
      map.set(teamId, squad);
    }
    return map;
  }, [playersPage]);

  const { openCreate, openEdit, openTeamHeads, askToggleStatus, askDelete } = actions;

  // Team leads because the first column stays frozen when the table scrolls sideways.
  const columns = useMemo<Column<Team>[]>(
    () => [
      {
        header: "Team",
        sortable: true,
        sortValue: (t) => t.name,
        cell: (t) => (
          <div className="flex items-center gap-3 min-w-0">
            {t.logo ? (
              <LightboxImage
                src={t.logo}
                alt={t.name}
                thumbnailClassName="w-10 h-10 shrink-0 rounded-lg object-contain bg-gray-50 dark:bg-gray-700/50 p-1 border border-gray-100 dark:border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 shrink-0 rounded-lg bg-sffl-navy/10 dark:bg-sffl-navy/50 flex items-center justify-center text-xs font-black text-sffl-navy dark:text-gray-200">
                {t.short_name?.slice(0, 3) || (
                  <ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
            )}
            <div className="min-w-0">
              <Link
                to={`/admin/teams/${t.id}`}
                className="block font-bold text-sm text-sffl-navy dark:text-white hover:text-sffl-red dark:hover:text-sffl-red underline decoration-gray-300 dark:decoration-gray-600 underline-offset-4 hover:decoration-sffl-red wrap-break-word"
              >
                {t.name}
              </Link>
              {t.short_name && (
                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t.short_name}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        header: "Team Heads",
        sortable: true,
        sortValue: (t) => (headsByTeam.get(t.id) ?? []).join(", "),
        cell: (t) => {
          const heads = headsByTeam.get(t.id);
          if (!candidates) return <span className="text-gray-400">—</span>;
          return heads?.length ? (
            <span className="text-sm text-gray-900 dark:text-gray-200 wrap-break-word">
              {heads.join(", ")}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
              No team head
            </span>
          );
        },
      },
      {
        header: "Squad",
        sortable: true,
        sortValue: (t) => squadByTeam.get(t.id)?.main ?? -1,
        cell: (t) => {
          // The players endpoint leaves out players of inactive teams.
          if (t.status === "inactive")
            return (
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Hidden while inactive
              </span>
            );
          if (loadingPlayers) return <span className="text-gray-400">—</span>;
          const squad = squadByTeam.get(t.id) ?? { main: 0, reserves: 0 };
          return (
            <span className="text-sm whitespace-nowrap">
              <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                {squad.main}/{MAX_MAIN_SQUAD}
              </span>{" "}
              <span className="text-gray-500 dark:text-gray-400">
                main · {squad.reserves} reserve{squad.reserves === 1 ? "" : "s"}
              </span>
            </span>
          );
        },
      },
      {
        header: "Status",
        sortable: true,
        sortValue: (t) => t.status || "active",
        cell: (t) => <TeamStatusBadge status={t.status} />,
      },
      {
        header: "Actions",
        align: "right",
        cell: (t) => {
          const inactive = t.status === "inactive";
          return (
            <RowActions
              label={`Actions for ${t.name}`}
              actions={[
                {
                  label: "View team profile",
                  icon: IdentificationIcon,
                  onSelect: () => navigate(`/admin/teams/${t.id}`),
                },
                { label: "Edit team", icon: PencilSquareIcon, onSelect: () => openEdit(t) },
                {
                  label: "Manage team heads",
                  icon: UserGroupIcon,
                  onSelect: () => openTeamHeads(t),
                },
                inactive
                  ? { label: "Mark active", icon: EyeIcon, onSelect: () => askToggleStatus(t) }
                  : {
                      label: "Mark inactive",
                      icon: EyeSlashIcon,
                      hint: "Hides it from public pages",
                      onSelect: () => askToggleStatus(t),
                    },
                {
                  label: "Delete team",
                  icon: TrashIcon,
                  danger: true,
                  onSelect: () => askDelete(t),
                },
              ]}
            />
          );
        },
      },
    ],
    [
      headsByTeam,
      squadByTeam,
      candidates,
      loadingPlayers,
      navigate,
      openEdit,
      openTeamHeads,
      askToggleStatus,
      askDelete,
    ],
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Teams"
        subtitle="Every team in the league with its team heads, squad and status. Select a team's name to see its full profile."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 bg-sffl-red text-white text-sm font-bold min-h-11 rounded-lg shadow-sm hover:shadow-md hover:bg-red-700 transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            <PlusIcon className="w-4 h-4" aria-hidden="true" />
            Add Team
          </button>
        }
      />

      {queryError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
          {getApiErrorMessage(queryError, "Failed to load teams.")}
        </div>
      )}

      <DataTable
        data={teams}
        columns={columns}
        searchPlaceholder="Search by name or short name"
        itemsPerPage={PAGE_SIZE}
        serverPage={page}
        totalServerPages={totalPages}
        onPageChange={setPage}
        onSearchSubmit={(term) => {
          setSearch(term.trim());
          setPage(1);
        }}
        loading={isLoading}
        getRowId={(t) => t.id}
        emptyMessage={
          search
            ? `No teams match "${search}".`
            : statusFilter === "all"
              ? "No teams yet. Use Add Team to create the first one."
              : `No ${statusFilter} teams.`
        }
        headerActions={
          <div
            role="group"
            aria-label="Filter by status"
            className="inline-flex p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-3 sm:px-4 py-1.5 min-h-11 text-xs font-extrabold rounded-lg capitalize transition-all ${
                    active
                      ? "bg-white dark:bg-gray-800 text-sffl-navy dark:text-white shadow-sm border border-gray-200 dark:border-gray-600"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        }
      />

      <TeamActionDialogs {...actions.dialogProps} />
    </div>
  );
};

export default AdminTeams;
