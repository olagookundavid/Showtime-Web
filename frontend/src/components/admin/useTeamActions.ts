import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  assignTeamManager,
  createTeam,
  deleteTeam,
  removeTeamManager,
  updateTeam,
  type Team,
  type TeamManager,
} from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiError";

// Shared with the Teams table and the team page, so an assignment made in the
// dialog shows up on both without a reload.
export const MANAGER_CANDIDATES_KEY = ["adminManagerCandidates"] as const;
export const teamManagersKey = (teamId: string) =>
  ["adminTeamManagers", teamId] as const;

// The main-squad cap the backend's roster rules enforce.
export const MAX_MAIN_SQUAD = 25;

// Every write goes through the confirm dialog first.
export type PendingTeamAction =
  | { kind: "save" }
  | { kind: "delete"; team: Team }
  | { kind: "toggleStatus"; team: Team }
  | { kind: "assign"; userId: string; label: string }
  | { kind: "removeManager"; manager: TeamManager };

export type TeamForm = { name: string; short_name: string; logo: string; status: string };

const EMPTY_FORM: TeamForm = { name: "", short_name: "", logo: "", status: "active" };

/**
 * Every write for a team (create, edit, status, delete, team heads), so the
 * Teams table and the team page behave the same way. Render
 * `<TeamActionDialogs {...dialogProps} />` once on the page.
 */
export function useTeamActions({
  onDeleted,
}: { onDeleted?: (team: Team) => void } = {}) {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [headsTeam, setHeadsTeam] = useState<Team | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Delete, status change and the two team-head actions share this flag; saving has its own.
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingTeamAction | null>(null);

  const refreshTeams = () => {
    for (const key of ["adminTeams", "adminTeamLookup", "publicTeams", "adminTeamsAll", "adminTeamsList"])
      queryClient.invalidateQueries({ queryKey: [key] });
  };
  const refreshHeads = (teamId: string) => {
    queryClient.invalidateQueries({ queryKey: teamManagersKey(teamId) });
    queryClient.invalidateQueries({ queryKey: MANAGER_CANDIDATES_KEY });
  };

  // Stable between renders, so callers can memoize table columns that use them.
  const openCreate = useCallback(() => {
    setEditingTeam(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((team: Team) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      short_name: team.short_name,
      logo: team.logo,
      status: team.status || "active",
    });
    setFormOpen(true);
  }, []);

  const openTeamHeads = useCallback((team: Team) => {
    setSelectedUserId("");
    setHeadsTeam(team);
  }, []);

  const askToggleStatus = useCallback(
    (team: Team) => setPendingAction({ kind: "toggleStatus", team }),
    [],
  );
  const askDelete = useCallback(
    (team: Team) => setPendingAction({ kind: "delete", team }),
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTeam) {
        await updateTeam(editingTeam.id, form);
        toast.success("Team updated");
      } else {
        await createTeam(form);
        toast.success("Team created");
      }
      setFormOpen(false);
      refreshTeams();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save team."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (team: Team) => {
    const nextStatus = team.status === "inactive" ? "active" : "inactive";
    try {
      await updateTeam(team.id, {
        name: team.name,
        short_name: team.short_name,
        logo: team.logo,
        status: nextStatus,
      });
      toast.success(`Team marked as ${nextStatus}`);
      refreshTeams();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update team status."));
    }
  };

  const handleDelete = async (team: Team) => {
    try {
      await deleteTeam(team.id);
      toast.success("Team deleted");
      refreshTeams();
      onDeleted?.(team);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete team."));
    }
  };

  const handleAssign = async (userId: string) => {
    if (!userId || !headsTeam) return;
    try {
      await assignTeamManager(headsTeam.id, userId);
      setSelectedUserId("");
      toast.success("Team head assigned");
    } catch (err) {
      // The backend blocks assigning someone who already manages a different
      // team and names that team in its message, so admins get a clear reason.
      toast.error(getApiErrorMessage(err, "Failed to assign team head."));
    } finally {
      refreshHeads(headsTeam.id);
    }
  };

  const handleRemoveManager = async (manager: TeamManager) => {
    try {
      await removeTeamManager(manager.team_id, manager.user_id);
      toast.success("Team head removed");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to remove team head."));
    } finally {
      refreshHeads(manager.team_id);
    }
  };

  // Runs once the admin confirms. The handlers report their own errors, so the
  // dialog always closes afterwards (a failed save leaves the form open).
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "save") {
      await handleSave();
    } else {
      setBusy(true);
      try {
        if (pendingAction.kind === "delete") await handleDelete(pendingAction.team);
        else if (pendingAction.kind === "toggleStatus")
          await handleToggleStatus(pendingAction.team);
        else if (pendingAction.kind === "assign") await handleAssign(pendingAction.userId);
        else await handleRemoveManager(pendingAction.manager);
      } finally {
        setBusy(false);
      }
    }
    setPendingAction(null);
  };

  return {
    openCreate,
    openEdit,
    openTeamHeads,
    askToggleStatus,
    askDelete,
    dialogProps: {
      formOpen,
      closeForm: () => setFormOpen(false),
      editingTeam,
      form,
      setForm,
      saving,
      headsTeam,
      closeTeamHeads: () => setHeadsTeam(null),
      selectedUserId,
      setSelectedUserId,
      pendingAction,
      setPendingAction,
      pending: saving || busy,
      confirmPendingAction,
    },
  };
}

export type TeamActionDialogsProps = ReturnType<typeof useTeamActions>["dialogProps"];
