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
} from "@heroicons/react/24/outline";
import {
  getManagerCandidates,
  getTeamManagers,
} from "../../services/api";
import type { Team } from "../../types/matches";
import type { TeamManager } from "../../types/adminTeams";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ConfirmSummary } from "../ui/ConfirmSummary";
import { Spinner } from "../ui/Spinner";
import { Button, Field, ImageUploadField, Input, Modal, Select } from "../ui";
import {
  teamManagersKey,
  type TeamActionDialogsProps,
} from "./useTeamActions";
import { MANAGER_CANDIDATES_KEY } from "../../constants";

const NO_MANAGERS: TeamManager[] = [];

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
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingTeam ? "Edit Team" : "New Team"}
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              disabled={saving || !form.name.trim()}
              loading={saving}
              onClick={() => setPendingAction({ kind: "save" })}
            >
              {editingTeam ? "Save Changes" : "Create Team"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Team Name *" htmlFor="team-name">
            <Input
              id="team-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
              placeholder="e.g. LAGOS GUARDIANS"
            />
          </Field>
          <Field label="Short Name" htmlFor="team-short-name" hint="Shown where space is tight, such as scoreboards.">
            <Input
              id="team-short-name"
              type="text"
              value={form.short_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, short_name: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. LGD"
            />
          </Field>
          <Field
            label="Status *"
            htmlFor="team-status"
            hint="Inactive teams are hidden from public team pages and selection dropdowns."
          >
            <Select
              id="team-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <ImageUploadField
            label="Team Logo"
            value={form.logo}
            onChange={(url) => setForm((f) => ({ ...f, logo: url }))}
            folder="teams"
            helperText="Upload a logo."
            isCommitted={saving}
          />
        </div>
      </Modal>

      <Modal
        open={!!headsTeam}
        onClose={closeTeamHeads}
        title="Team Heads"
        maxWidth="lg"
        footer={
          <Button variant="secondary" onClick={closeTeamHeads}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 wrap-break-word">
            Team heads run {headsTeamName}'s roster, contracts and team sheets from their own dashboard.
          </p>
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
                      <Button
                        variant="danger"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setPendingAction({ kind: "removeManager", manager: m })}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* min-w-0 is load-bearing: a flex child's implicit min-width:auto
                    otherwise overrides `truncate`, and a long option label pushes
                    the Assign button off-screen. shrink-0 keeps the button whole. */}
                <Field label="Assign Team Head" htmlFor="team-head-select">
                  <div className="flex gap-2">
                    <Select
                      id="team-head-select"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="min-w-0 flex-1"
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
                    </Select>
                    <Button
                      variant="success"
                      className="shrink-0"
                      disabled={!selectedUserId}
                      onClick={() => {
                        const c = candidates.find((x) => x.user_id === selectedUserId);
                        setPendingAction({
                          kind: "assign",
                          userId: selectedUserId,
                          label: c?.full_name || c?.email || "Selected user",
                        });
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                </Field>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Only users with the Team Head role are listed. Greyed-out names already manage
                  another team, so assigning them will explain why it's blocked.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>

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
