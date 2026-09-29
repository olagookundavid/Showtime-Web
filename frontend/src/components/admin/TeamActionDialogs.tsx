import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getManagerCandidates,
  getTeamManagers,
  type Team,
  type TeamManager,
} from "../../services/api";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ConfirmSummary } from "../ui/ConfirmSummary";
import { Spinner } from "../ui/Spinner";
import { ImageUploadField } from "../ui";
import {
  MANAGER_CANDIDATES_KEY,
  teamManagersKey,
  type TeamActionDialogsProps,
} from "./useTeamActions";

const NO_MANAGERS: TeamManager[] = [];

const inputClass =
  "w-full min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-sffl-red";
const labelClass = "block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1";
const overlayClass =
  "fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden";
const panelClass =
  "bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto border border-gray-200 dark:border-gray-700";
const closeButtonClass =
  "shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";

const managerName = (m: TeamManager) =>
  m.user_full_name || m.user_email || "Unknown user";

const teamRows = (team: Team): [string, string | undefined][] => [
  ["Name", team.name],
  ["Short name", team.short_name || undefined],
];

/** The create/edit form, the team-heads manager and the confirm dialog behind `useTeamActions`. */
export const TeamActionDialogs = ({
  formOpen,
  closeForm,
  editingTeam,
  form,
  setForm,
  saving,
  headsTeam,
  closeTeamHeads,
  selectedUserId,
  setSelectedUserId,
  pendingAction,
  setPendingAction,
  pending,
  confirmPendingAction,
}: TeamActionDialogsProps) => {
  const { data: managers = NO_MANAGERS, isLoading: loadingManagers } = useQuery({
    queryKey: teamManagersKey(headsTeam?.id ?? ""),
    queryFn: () => getTeamManagers(headsTeam!.id),
    enabled: !!headsTeam,
  });
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: MANAGER_CANDIDATES_KEY,
    queryFn: getManagerCandidates,
    enabled: !!headsTeam,
  });

  const headsTeamName = headsTeam?.name ?? "this team";

  // Already listed with a Remove button, so not offered again.
  const assignable = candidates.filter(
    (c) => !managers.some((m) => m.user_id === c.user_id),
  );

  let dialog: {
    title: string;
    description?: string;
    confirmLabel: string;
    tone: "success" | "info" | "warning";
    icon: ComponentType<{ className?: string }>;
    body: ReactNode;
  } | null = null;
  switch (pendingAction?.kind) {
    case "save":
      dialog = {
        title: editingTeam ? "Save changes to this team?" : "Create this team?",
        confirmLabel: editingTeam ? "Save Changes" : "Create Team",
        tone: "info",
        icon: editingTeam ? PencilSquareIcon : CheckCircleIcon,
        body: (
          <ConfirmSummary
            rows={[
              ["Name", form.name],
              ["Short name", form.short_name || undefined],
              ["Status", form.status === "inactive" ? "Inactive" : "Active"],
            ]}
          />
        ),
      };
      break;
    case "delete":
      dialog = {
        title: "Delete this team for good?",
        // The database removes everything that belongs to the team with it.
        description:
          "This also deletes its players, matches, standings, contracts and stats, and can't be undone. To hide a team but keep its history, mark it inactive instead.",
        confirmLabel: "Delete Team",
        tone: "warning",
        icon: TrashIcon,
        body: <ConfirmSummary rows={teamRows(pendingAction.team)} />,
      };
      break;
    case "toggleStatus": {
      const toInactive = pendingAction.team.status !== "inactive";
      dialog = {
        title: toInactive ? "Mark this team as inactive?" : "Mark this team as active?",
        description: toInactive
          ? "Inactive teams are hidden from public team pages and selection dropdowns. Nothing is deleted, and you can make it active again at any time."
          : "Active teams appear on public team pages and in selection dropdowns.",
        confirmLabel: toInactive ? "Mark Inactive" : "Mark Active",
        tone: toInactive ? "warning" : "success",
        icon: toInactive ? EyeSlashIcon : EyeIcon,
        body: <ConfirmSummary rows={teamRows(pendingAction.team)} />,
      };
      break;
    }
    case "assign":
      dialog = {
        title: "Assign this team head?",
        description: `They will manage ${headsTeamName}.`,
        confirmLabel: "Assign",
        tone: "info",
        icon: UserPlusIcon,
        body: (
          <ConfirmSummary
            rows={[
              ["Person", pendingAction.label],
              ["Team", headsTeamName],
            ]}
          />
        ),
      };
      break;
    case "removeManager":
      dialog = {
        title: "Remove this team head?",
        description: `They will no longer manage ${headsTeamName}.`,
        confirmLabel: "Remove",
        tone: "warning",
        icon: UserMinusIcon,
        body: (
          <ConfirmSummary
            rows={[
              ["Person", managerName(pendingAction.manager)],
              ["Team", headsTeamName],
            ]}
          />
        ),
      };
      break;
  }

  return (
    <>
      {formOpen && (
        <div className={overlayClass} data-dialog onClick={closeForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-form-title"
            className={`${panelClass} max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between gap-3">
              <h2
                id="team-form-title"
                className="text-xl sm:text-2xl font-black text-sffl-navy dark:text-white"
              >
                {editingTeam ? "Edit Team" : "New Team"}
              </h2>
              <button type="button" onClick={closeForm} aria-label="Close" className={closeButtonClass}>
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              <div>
                <label htmlFor="team-name" className={labelClass}>
                  Team Name *
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
                  className={`${inputClass} uppercase`}
                  placeholder="e.g. LAGOS GUARDIANS"
                />
              </div>
              <div>
                <label htmlFor="team-short-name" className={labelClass}>
                  Short Name
                </label>
                <input
                  id="team-short-name"
                  type="text"
                  value={form.short_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, short_name: e.target.value.toUpperCase() }))
                  }
                  className={`${inputClass} uppercase`}
                  placeholder="e.g. LGD"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Shown where space is tight, such as scoreboards.
                </p>
              </div>
              <div>
                <label htmlFor="team-status" className={labelClass}>
                  Status *
                </label>
                <select
                  id="team-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={`${inputClass} font-medium text-sm`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Inactive teams are hidden from public team pages and selection dropdowns.
                </p>
              </div>
              <ImageUploadField
                label="Team Logo"
                value={form.logo}
                onChange={(url) => setForm((f) => ({ ...f, logo: url }))}
                folder="teams"
                helperText="Upload a logo."
                isCommitted={saving}
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 bg-gray-50 dark:bg-gray-800/90">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 min-h-11 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ kind: "save" })}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2.5 min-h-11 bg-sffl-red text-white font-bold text-sm rounded-xl shadow-sm hover:shadow-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingTeam ? "Save Changes" : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {headsTeam && (
        <div className={overlayClass} data-dialog onClick={closeTeamHeads}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-heads-title"
            className={`${panelClass} max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="team-heads-title"
                  className="wrap-break-word text-xl sm:text-2xl font-black text-sffl-navy dark:text-white"
                >
                  Team Heads
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 wrap-break-word">
                  Team heads run {headsTeamName}'s roster, contracts and team sheets from their own dashboard.
                </p>
              </div>
              <button type="button" onClick={closeTeamHeads} aria-label="Close" className={closeButtonClass}>
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {loadingManagers || loadingCandidates ? (
                <Spinner />
              ) : (
                <>
                  {managers.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No team head yet. Pick one below.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {managers.map((m) => (
                        <li key={m.id} className="flex items-center justify-between py-2 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                              {managerName(m)}
                            </p>
                            {m.user_full_name && m.user_email && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {m.user_email}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPendingAction({ kind: "removeManager", manager: m })}
                            className="shrink-0 min-h-11 px-3 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 text-sm font-bold transition-colors"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label
                      htmlFor="team-head-select"
                      className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Assign Team Head
                    </label>
                    <div className="flex gap-2">
                      {/* min-w-0 is load-bearing: a flex child's implicit min-width:auto
                          otherwise overrides `truncate`, and a long option label pushes
                          the Assign button off-screen. shrink-0 keeps the button whole. */}
                      <select
                        id="team-head-select"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="min-w-0 flex-1 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white truncate"
                      >
                        <option value="">Select a team head</option>
                        {assignable.map((c) => {
                          const managesElsewhere = !!c.assigned_team_id;
                          return (
                            <option
                              key={c.user_id}
                              value={c.user_id}
                              style={managesElsewhere ? { color: "#9ca3af" } : undefined}
                            >
                              {c.full_name || c.email}
                              {managesElsewhere ? ` — Manager of ${c.assigned_team_name}` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const c = candidates.find((x) => x.user_id === selectedUserId);
                          setPendingAction({
                            kind: "assign",
                            userId: selectedUserId,
                            label: c?.full_name || c?.email || "Selected user",
                          });
                        }}
                        disabled={!selectedUserId}
                        className="shrink-0 px-4 py-2 min-h-11 bg-green-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:bg-green-700 disabled:opacity-50 text-sm transition-all"
                      >
                        Assign
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      Only users with the Team Head role are listed. Greyed-out names already manage
                      another team, so assigning them will explain why it's blocked.
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={closeTeamHeads}
                className="w-full sm:w-auto px-4 py-2 min-h-11 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outside the modals: portal clicks bubble through the React tree, so
          inside one a backdrop click would also close the modal beneath. */}
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        body={dialog?.body}
        confirmLabel={dialog?.confirmLabel ?? ""}
        tone={dialog?.tone}
        icon={dialog?.icon}
        pending={pending}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
};
