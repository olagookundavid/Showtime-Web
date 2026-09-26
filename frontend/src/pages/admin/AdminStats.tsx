import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getCompetitions,
  getMatches,
  getAdminTeamSheet,
  upsertPlayerStat,
  getPlayerStatById,
  recomputeAllStats,
  type Competition,
  type Match,
  type TeamSheetPlayer,
  type BulkRecomputeResult,
} from "../../services/api";
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Loader } from "../../components/ui/Loader";
import { Spinner } from "../../components/ui/Spinner";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { LightboxImage } from "../../components/ui";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { useAuth } from "../../contexts/AuthContext";
import {
  ALL_STAT_DEFINITIONS,
  getStatsForPosition,
} from "../../utils/positionStatsMatrix";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

const STAT_FIELDS = ALL_STAT_DEFINITIONS.filter((s) => !s.teamOnly);

type FormState = Record<string, string>;

const emptyForm: FormState = STAT_FIELDS.reduce((acc, field) => {
  acc[field.key] = "0";
  return acc;
}, {} as FormState);

// A stable empty list, so the table isn't handed a fresh array on every render.
const NO_PLAYERS: TeamSheetPlayer[] = [];

export const AdminStats = () => {
  const { user } = useAuth();
  // Manual stat editing is reserved for App Admins — everyone else sees the
  // numbers read-only. (Play-by-play remains the primary way stats are set.)
  const isAppAdmin = user?.role === "app_admin";
  const [selectedComp, setSelectedComp] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Queries
  const { data: compData, isLoading: loadingComps } = useQuery({
    queryKey: ["adminCompsList"],
    queryFn: () => getCompetitions(1, 100),
  });
  const comps: Competition[] = (compData?.data || []).filter(
    (c) => c.status !== "inactive",
  );
  const selectedCompData = comps.find((c) => c.id === selectedComp);
  const isCompleted = selectedCompData?.status === "completed";

  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: ["adminMatchesForStats", selectedComp],
    queryFn: () => getMatches(selectedComp, 1, 100),
    enabled: !!selectedComp,
  });
  const matches: Match[] = useMemo(
    () => matchesData?.data || [],
    [matchesData?.data],
  );
  const activeMatch = matches.find((m) => m.id === selectedMatch);

  const { data: teamSheetData, isLoading: loadingTeamSheet } = useQuery({
    queryKey: ["adminTeamSheet", selectedMatch],
    queryFn: () => getAdminTeamSheet(selectedMatch),
    enabled: !!selectedMatch,
  });

  // Auto-select latest competition
  useEffect(() => {
    if (comps.length > 0 && !selectedComp) {
      setSelectedComp(comps[0].id);
    }
  }, [comps, selectedComp]);

  // Auto-select first match when matches load
  useEffect(() => {
    if (
      matches.length > 0 &&
      (!selectedMatch || !matches.find((m) => m.id === selectedMatch))
    ) {
      setSelectedMatch(matches[0].id);
    } else if (matches.length === 0) {
      setSelectedMatch("");
    }
  }, [matches, selectedMatch]);

  // Auto-select Home Team when Match loads
  useEffect(() => {
    if (
      activeMatch &&
      activeMatch.home_team &&
      (!selectedTeamId ||
        (selectedTeamId !== activeMatch.home_team?.id &&
          selectedTeamId !== activeMatch.away_team?.id))
    ) {
      setSelectedTeamId(activeMatch.home_team.id);
    }
  }, [activeMatch, selectedTeamId]);

  let players: TeamSheetPlayer[] = NO_PLAYERS;
  if (teamSheetData && activeMatch) {
    if (selectedTeamId === activeMatch.home_team?.id) {
      players = teamSheetData.home_team || NO_PLAYERS;
    } else if (selectedTeamId === activeMatch.away_team?.id) {
      players = teamSheetData.away_team || NO_PLAYERS;
    }
  }

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [activePlayer, setActivePlayer] = useState<TeamSheetPlayer | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  // Saving the stats asks first.
  const [confirmSave, setConfirmSave] = useState(false);

  // Stable between renders, so the table columns below can be memoized.
  const openStatsModal = useCallback(
    async (p: TeamSheetPlayer) => {
      if (!isAppAdmin) {
        toast.error("Only App Admins can edit stats manually");
        return;
      }
      if (!selectedComp || !selectedMatch) {
        toast.error("Please select a Competition and Match first");
        return;
      }
      setActivePlayer(p);
      setLoadingExisting(true);
      setShowModal(true);

      try {
        const existing = await getPlayerStatById(
          p.player_id,
          selectedComp,
          undefined,
          selectedMatch,
        );

        if (existing) {
          const loadedForm: FormState = { ...emptyForm };
          STAT_FIELDS.forEach((f) => {
            loadedForm[f.key] = String(
              (existing as unknown as Record<string, unknown>)[f.key] || 0,
            );
          });
          setForm(loadedForm);
          toast.success("Existing stats loaded for editing");
        } else {
          setForm(emptyForm);
        }
      } catch (err) {
        console.error("Failed to fetch existing stats:", err);
        setForm(emptyForm);
      } finally {
        setLoadingExisting(false);
      }
    },
    [isAppAdmin, selectedComp, selectedMatch],
  );

  const handleSave = async () => {
    if (!activePlayer || !selectedComp || !selectedMatch || !activeMatch)
      return;
    setSaving(true);
    try {
      const payload = {
        player_id: activePlayer.player_id,
        team_id: selectedTeamId,
        competition_id: selectedComp,
        match_id: selectedMatch,
        match_date: activeMatch.date.split("T")[0],
        ...Object.fromEntries(
          STAT_FIELDS.map((f) => [f.key, parseInt(form[f.key]) || 0]),
        ),
      };

      await upsertPlayerStat(payload);
      toast.success("Stats recorded successfully!");
      setShowModal(false);
    } catch (err: unknown) {
      console.error(err);
      const response =
        typeof err === "object" && err !== null && "response" in err
          ? (
              err as {
                response?: { data?: { error?: string; message?: string } };
              }
            ).response
          : undefined;
      toast.error(
        response?.data?.error ||
          response?.data?.message ||
          "Failed to save stats",
      );
    } finally {
      setSaving(false);
    }
  };

  // Player leads because the first column stays frozen when the table scrolls sideways.
  const columns = useMemo<Column<TeamSheetPlayer>[]>(
    () => [
      {
        header: "Player",
        sortable: true,
        sortValue: (p) => p.name,
        cell: (p) => (
          <div className="flex items-center gap-3">
            {p.image ? (
              <LightboxImage
                src={p.image}
                alt={p.name}
                thumbnailClassName="w-8 h-8 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                #{p.jersey_number}
              </div>
            )}
            <span className="font-semibold text-sm text-gray-900 dark:text-white wrap-break-word">
              {p.name}
            </span>
          </div>
        ),
      },
      {
        header: "#",
        accessor: "jersey_number",
        sortable: true,
        className: "px-4 py-3 w-16",
        cell: (p) => (
          <span className="font-bold text-sm dark:text-gray-300">
            {p.jersey_number}
          </span>
        ),
      },
      {
        header: "Position",
        accessor: "position",
        sortable: true,
        cell: (p) => (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs font-bold dark:text-gray-300">
            {p.position || "N/A"}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (p) => (
          <RowActions
            label={`Actions for ${p.name}`}
            actions={[
              {
                label: "Edit Stats",
                icon: PencilSquareIcon,
                disabled: isCompleted || !isAppAdmin,
                hint: isCompleted
                  ? "Competition is completed"
                  : !isAppAdmin
                    ? "Only App Admins can edit stats manually"
                    : undefined,
                onSelect: () => openStatsModal(p),
              },
            ]}
          />
        ),
      },
    ],
    [isCompleted, isAppAdmin, openStatsModal],
  );
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stats"
        subtitle="Select match context to record player stats."
      />

      {/* Context Selectors */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Competition *
          </label>
          <select
            value={selectedComp}
            onChange={(e) => setSelectedComp(e.target.value)}
            className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Match *
          </label>
          <select
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={loadingMatches || matches.length === 0}
          >
            {matches.length === 0 && <option value="">No matches found</option>}
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.date.split("T")[0]} :{" "}
                {(
                  m.home_team?.short_name ||
                  m.home_team?.name ||
                  "Home"
                ).toUpperCase()}{" "}
                vs{" "}
                {(
                  m.away_team?.short_name ||
                  m.away_team?.name ||
                  "Away"
                ).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Team Filter
          </label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={!activeMatch}
          >
            {activeMatch && activeMatch.home_team && activeMatch.away_team ? (
              <>
                <option value={activeMatch.home_team.id}>
                  {activeMatch.home_team.name}
                </option>
                <option value={activeMatch.away_team.id}>
                  {activeMatch.away_team.name}
                </option>
              </>
            ) : (
              <option value="">Select a match first</option>
            )}
          </select>
        </div>
      </div>

      {isCompleted && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-400 font-bold text-sm">
          <LockClosedIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>
            Season Completed. Stats are locked and cannot be modified.
          </span>
        </div>
      )}

      {loadingComps || loadingMatches || loadingTeamSheet ? (
        <Loader />
      ) : !selectedMatch ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 font-semibold">
            Please select a Match to view players.
          </p>
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 font-semibold">
            No players found on the team sheet for this team. Please add them
            via Match Management.
          </p>
        </div>
      ) : (
        <DataTable
          data={players}
          columns={columns}
          searchable={true}
          searchPlaceholder="Search players..."
          itemsPerPage={20}
          getRowId={(p) => p.player_id}
        />
      )}

      {/* Stats Entry Modal */}
      {showModal && activePlayer && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-dialog
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white">
                  Record Stats
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  <span className="font-bold text-sffl-red">
                    {activePlayer.name}
                  </span>{" "}
                  • {activeMatch?.date.split("T")[0]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 sm:p-6 relative overflow-y-auto overscroll-contain flex-1 min-h-0">
              {loadingExisting && (
                <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                  <Spinner />
                </div>
              )}

              <div className="flex items-start gap-2 bg-sffl-navy/5 dark:bg-gray-700/50 text-sffl-navy dark:text-gray-200 p-4 rounded-xl mb-6 text-sm font-medium border border-sffl-navy/10 dark:border-gray-600">
                <InformationCircleIcon
                  className="w-5 h-5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Update the stats for this player.{" "}
                  <b>Saving will add to existing stats</b> for this specific
                  match.
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getStatsForPosition(
                  activePlayer.position,
                  activePlayer.secondary_position,
                )
                  .filter((s) => !s.teamOnly)
                  .map((field) => (
                    <div
                      key={field.key}
                      className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-600"
                    >
                      <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        value={form[field.key] ?? "0"}
                        onChange={(e) =>
                          setForm({ ...form, [field.key]: e.target.value })
                        }
                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 min-h-11 font-bold text-center text-gray-900 dark:text-white focus:ring-2 focus:ring-sffl-red focus:border-sffl-red outline-none transition-all"
                      />
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gray-50 dark:bg-gray-800/90 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all min-h-11 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmSave(true)}
                disabled={saving}
                className="px-8 py-2.5 bg-sffl-red hover:bg-red-700 text-white font-black uppercase tracking-wider text-sm rounded-xl shadow-sm hover:shadow-md transition-all duration-300 min-h-11 disabled:opacity-50 flex items-center gap-2"
              >
                Update Stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outside the modal: portal clicks bubble through the React tree, so inside it a
                backdrop click would also close the stats form. */}
      <ConfirmDialog
        open={confirmSave}
        title="Update stats for this player?"
        description="Saving will add to existing stats for this specific match."
        body={
          activePlayer && (
            <ConfirmSummary
              rows={[
                ["Player", activePlayer.name],
                [
                  "Match",
                  activeMatch
                    ? `${activeMatch.home_team?.short_name || activeMatch.home_team?.name || "Home"} vs ${activeMatch.away_team?.short_name || activeMatch.away_team?.name || "Away"}`
                    : undefined,
                ],
                ["Date", activeMatch?.date.split("T")[0]],
              ]}
            />
          )
        }
        confirmLabel="Update Stats"
        tone="info"
        icon={PencilSquareIcon}
        pending={saving}
        onConfirm={async () => {
          await handleSave();
          setConfirmSave(false);
        }}
        onCancel={() => setConfirmSave(false)}
      />

      {isAppAdmin && (
        <RecomputeAllStatsPanel
          competitionId={selectedComp}
          competitionName={comps.find((c) => c.id === selectedComp)?.name}
        />
      )}
    </div>
  );
};

// Maintenance tool: re-derive stats for every match that has a play log, so a
// change to the derivation (new stat columns, a corrected rule) takes effect
// everywhere at once instead of only on matches someone happens to edit.
// Always dry-run first — the preview shows each match's play count, which is how
// you spot a match with a thin/partial log that would lose data if derived over.
const RecomputeAllStatsPanel = ({
  competitionId,
  competitionName,
}: {
  competitionId?: string;
  competitionName?: string;
}) => {
  const [scopeAll, setScopeAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BulkRecomputeResult | null>(null);
  // Rewriting stats for real asks first. The dry-run preview only reads, so it does not.
  const [confirmRun, setConfirmRun] = useState(false);

  const scopeLabel = scopeAll
    ? "ALL competitions"
    : competitionName || "the selected competition";
  const scopedId = scopeAll ? undefined : competitionId;

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await recomputeAllStats({ competitionId: scopedId, dryRun });
      setPreview(res);
      if (dryRun) {
        toast.success(`${res.matches_found} match(es) would be recomputed`);
      } else {
        toast.success(
          `Recomputed ${res.matches_updated} match(es), ${res.players_updated} player line(s)`,
        );
        if (res.failed > 0)
          toast.error(`${res.failed} match(es) failed — see the list below`);
      }
    } catch (e: unknown) {
      const response =
        typeof e === "object" && e !== null && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response
          : undefined;
      toast.error(response?.data?.error || "Recompute failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
      <div>
        <h2 className="text-lg font-black text-sffl-navy dark:text-white">
          Recompute stats from play logs
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Rebuilds player &amp; team stats from the play-by-play log for every
          match that has one. Use after a derivation change so every match
          updates at once. Matches with <b>no play log are never touched</b>,
          and <b>scores/standings are not changed</b>.
        </p>
      </div>

      <label className="flex items-center gap-2 min-h-11 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 shrink-0"
          checked={scopeAll}
          onChange={(e) => {
            setScopeAll(e.target.checked);
            setPreview(null);
          }}
        />
        Every competition (otherwise just{" "}
        {competitionName || "the selected competition"})
      </label>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm text-sffl-navy dark:text-gray-200 disabled:opacity-50"
        >
          {busy && (
            <ArrowPathIcon
              className="w-4 h-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {busy ? "Working" : "1. Preview (dry run)"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmRun(true)}
          disabled={busy || !preview}
          title={!preview ? "Run the preview first" : undefined}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-11 bg-sffl-navy text-white rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy && (
            <ArrowPathIcon
              className="w-4 h-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {busy ? "Working" : "2. Recompute for real"}
        </button>
      </div>

      {preview && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/40 text-xs font-bold text-gray-600 dark:text-gray-300">
            {preview.dry_run ? "Would recompute" : "Recomputed"}{" "}
            {preview.matches_found} match(es)
            {!preview.dry_run && ` · ${preview.players_updated} player line(s)`}
            {preview.failed > 0 && ` · ${preview.failed} failed`}
          </div>
          <div className="max-h-64 overflow-auto divide-y divide-gray-100 dark:divide-gray-700/60">
            {preview.matches.map((m) => (
              <div
                key={m.match_id}
                className="px-3 py-1.5 text-xs flex items-center justify-between gap-3"
              >
                <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">
                  {m.label} <span className="text-gray-400">· {m.date}</span>
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 ${m.plays < 5 ? "text-amber-600 font-bold" : "text-gray-500"}`}
                    title={
                      m.plays < 5
                        ? "Very few plays — check this log is complete before recomputing"
                        : undefined
                    }
                  >
                    {m.plays} play{m.plays === 1 ? "" : "s"}
                    {m.plays < 5 && (
                      <ExclamationTriangleIcon
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {m.error ? (
                    <span className="text-red-600 font-bold" title={m.error}>
                      failed
                    </span>
                  ) : (
                    !preview.dry_run && (
                      <span className="text-green-600 font-bold">
                        {m.players} players
                      </span>
                    )
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRun}
        title={`Rewrite stats for ${preview?.matches_found ?? 0} match${(preview?.matches_found ?? 0) === 1 ? "" : "es"}?`}
        description="Matches with no play log are untouched. Scores and standings are not changed."
        body={
          <ConfirmSummary
            rows={[
              ["Scope", scopeLabel],
              ["Matches", String(preview?.matches_found ?? 0)],
            ]}
          />
        }
        confirmLabel="Recompute Stats"
        tone="warning"
        icon={ArrowPathIcon}
        pending={busy}
        onConfirm={async () => {
          await run(false);
          setConfirmRun(false);
        }}
        onCancel={() => setConfirmRun(false)}
      />
    </div>
  );
};
