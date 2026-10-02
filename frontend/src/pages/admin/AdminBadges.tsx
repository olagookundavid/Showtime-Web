import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getAdminBadges,
  createAdminBadge,
  updateAdminBadge,
  deleteAdminBadge,
  awardAdminBadge,
  getAdminBadgeAwards,
  deleteAdminBadgeAward,
  backfillMVPBadges,
  getCompetitions,
  getAllEventDays,
  getPlayers,
  type Badge,
  type PlayerBadgeAward,
  type CreateBadgePayload,
  type Competition,
  type EventDayResponse,
  type Player,
} from "../../services/api";
import { Loader } from "../../components/ui/Loader";
import { Spinner } from "../../components/ui/Spinner";
import { ImageUploadField } from "../../components/ui/ImageUploadField";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { RowActions } from "../../components/ui/RowActions";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { BadgeImage } from "../../components/common/BadgeImage";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  GiftIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";
import { usePermissions } from "../../hooks/usePermissions";

const COLOR_SCHEMES = [
  {
    value: "gold",
    label: "Gold (Amber)",
    bg: "bg-amber-400/20 text-amber-500 border-amber-400/40",
  },
  {
    value: "red",
    label: "Showtime Red",
    bg: "bg-red-500/20 text-red-500 border-red-500/40",
  },
  {
    value: "blue",
    label: "Showtime Navy/Blue",
    bg: "bg-blue-500/20 text-blue-500 border-blue-500/40",
  },
  {
    value: "green",
    label: "Emerald Green",
    bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/40",
  },
];

export interface OfficialBadgePreset {
  code: string;
  name: string;
  filename: string;
  imageUrl: string;
  localUrl: string;
  category: string;
  color_scheme: string;
  description: string;
}

const OFFICIAL_BADGE_PRESETS: OfficialBadgePreset[] = [
  {
    code: "MVP",
    name: "Game MVP",
    filename: "game-mvp.png",
    imageUrl: "https://cdn.sffl.football/badges/game-mvp.png",
    localUrl: "/badges/game-mvp.png",
    category: "Honors",
    color_scheme: "gold",
    description: "Awarded to the most valuable player of an official match",
  },
  {
    code: "POTW",
    name: "Player of the Week",
    filename: "player-of-the-week.png",
    imageUrl: "https://cdn.sffl.football/badges/player-of-the-week.png",
    localUrl: "/badges/player-of-the-week.png",
    category: "Honors",
    color_scheme: "gold",
    description:
      "Selected as the standout Player of the Week in the Showtime Team of the Week",
  },
  {
    code: "TOTW",
    name: "Team of the Week",
    filename: "team-of-the-week.png",
    imageUrl: "https://cdn.sffl.football/badges/team-of-the-week.png",
    localUrl: "/badges/team-of-the-week.png",
    category: "Honors",
    color_scheme: "red",
    description:
      "Selected as one of the top 14 players of the gameday Starting XIV",
  },
  {
    code: "TOTS",
    name: "Team of the Season",
    filename: "team-of-the-season.png",
    imageUrl: "https://cdn.sffl.football/badges/team-of-the-season.png",
    localUrl: "/badges/team-of-the-season.png",
    category: "Honors",
    color_scheme: "gold",
    description:
      "Selected in the prestigious Showtime Team of the Season roster",
  },
  {
    code: "DPOY",
    name: "Best Defender",
    filename: "best-defender.png",
    imageUrl: "https://cdn.sffl.football/badges/best-defender.png",
    localUrl: "/badges/best-defender.png",
    category: "Defence",
    color_scheme: "blue",
    description: "Honoring the premier defensive playmaker of the season",
  },
  {
    code: "OPOY",
    name: "Best Receiver",
    filename: "best-receiver.png",
    imageUrl: "https://cdn.sffl.football/badges/best-receiver.png",
    localUrl: "/badges/best-receiver.png",
    category: "Offence",
    color_scheme: "red",
    description:
      "Honoring the most outstanding pass-catcher and scoring receiver of the season",
  },
  {
    code: "BEST_RUSHER",
    name: "Best Rusher",
    filename: "best-rusher.png",
    imageUrl: "https://cdn.sffl.football/badges/best-rusher.png",
    localUrl: "/badges/best-rusher.png",
    category: "Defence",
    color_scheme: "red",
    description: "Awarded to the fiercest defensive pass rusher of the season",
  },
  {
    code: "BEST_CENTER",
    name: "Best Center",
    filename: "best-center.png",
    imageUrl: "https://cdn.sffl.football/badges/best-center.png",
    localUrl: "/badges/best-center.png",
    category: "Offence",
    color_scheme: "blue",
    description:
      "Awarded to the premier offensive lineman / center of the season",
  },
  {
    code: "ROOKIE_OF_THE_SEASON",
    name: "Rookie of the Season",
    filename: "rookie-of-the-season.png",
    imageUrl: "https://cdn.sffl.football/badges/rookie-of-the-season.png",
    localUrl: "/badges/rookie-of-the-season.png",
    category: "Honors",
    color_scheme: "gold",
    description: "Awarded to the most outstanding newcomer across the league",
  },
  {
    code: "TOURNAMENT_MVP",
    name: "Tournament MVP",
    filename: "tournament-mvp.png",
    imageUrl: "https://cdn.sffl.football/badges/tournament-mvp.png",
    localUrl: "/badges/tournament-mvp.png",
    category: "Honors",
    color_scheme: "gold",
    description:
      "Awarded to the most valuable player across tournament knockout championship play",
  },
];

// Awards rebuilt from their source (match MVP, published TOTW) can't be revoked
// here — the next sync would bring them back. The backend refuses them too.
const isAutomaticAward = (award: PlayerBadgeAward) =>
  !!award.totw_id || (award.badge?.code === "MVP" && !!award.match_id);

const awardContext = (award: PlayerBadgeAward) =>
  award.competition?.name || award.competition_name || award.season || "League";

const formatAwardDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

type PendingAction =
  | { kind: "saveBadge" }
  | { kind: "award" }
  | { kind: "deleteBadge"; badge: Badge }
  | { kind: "revoke"; award: PlayerBadgeAward }
  | { kind: "backfill" };

const FAILURE: Record<PendingAction["kind"], string> = {
  saveBadge: "Failed to save badge.",
  award: "Failed to award badge.",
  deleteBadge: "Failed to delete badge.",
  revoke: "Failed to revoke award.",
  backfill: "Failed to run MVP backfill.",
};

const fieldLabelClass =
  "block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1";
const fieldClass =
  "w-full min-h-11 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red";
const closeButtonClass =
  "shrink-0 min-h-11 min-w-11 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer";

export const AdminBadges = () => {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const canManage = canEdit("badges");

  // View state
  const [activeTab, setActiveTab] = useState<"catalog" | "awards">("catalog");

  // Every write waits here for the confirm dialog
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // Modals
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [badgeForm, setBadgeForm] = useState<CreateBadgePayload>({
    code: "",
    name: "",
    description: "",
    icon: "",
    color_scheme: "gold",
    category: "Honors",
  });

  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [awardBadgeId, setAwardBadgeId] = useState("");
  const [awardCompId, setAwardCompId] = useState("");
  const [awardSeason, setAwardSeason] = useState(
    new Date().getFullYear().toString(),
  );
  const [awardEventDayId, setAwardEventDayId] = useState("");
  const [awardReason, setAwardReason] = useState("");
  const [awardCount, setAwardCount] = useState(1);

  // Player search inside award modal
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // Queries
  const { data: badges = [], isLoading: loadingBadges } = useQuery<Badge[]>({
    queryKey: ["adminBadges"],
    queryFn: getAdminBadges,
  });

  const NO_AWARDS: PlayerBadgeAward[] = [];

  const { data: awardsResult, isLoading: loadingAwards } = useQuery({
    queryKey: ["adminBadgeAwards"],
    queryFn: () => getAdminBadgeAwards({ page: 1, limit: 100 }),
  });
  const awards = awardsResult?.data ?? NO_AWARDS;

  const { data: competitionsData } = useQuery({
    queryKey: ["adminCompetitions"],
    queryFn: () => getCompetitions(1, 100),
  });
  const competitions: Competition[] = competitionsData?.data || [];

  const { data: eventDays = [] } = useQuery<EventDayResponse[]>({
    queryKey: ["adminAllEventDays"],
    queryFn: getAllEventDays,
  });

  const { data: playersData, isLoading: loadingPlayers } = useQuery({
    queryKey: ["adminPlayersAwardPicker", playerSearchQuery],
    queryFn: () => getPlayers(undefined, 1, 40, playerSearchQuery || undefined),
    enabled: showAwardModal && !selectedPlayer,
  });
  const availablePlayers: Player[] = playersData?.data || [];

  const selectedBadge = badges.find((b) => b.id === awardBadgeId);

  const requestSaveBadge = () => {
    if (!editingBadge && !badgeForm.code.trim()) {
      toast.error("Please enter a badge code.");
      return;
    }
    if (!badgeForm.name.trim()) {
      toast.error("Please enter a badge name.");
      return;
    }
    if (!(badgeForm.icon || "").trim()) {
      toast.error("Please upload a badge image.");
      return;
    }
    setPendingAction({ kind: "saveBadge" });
  };

  const requestAward = () => {
    if (!selectedPlayer) {
      toast.error("Please select a player.");
      return;
    }
    if (!awardBadgeId) {
      toast.error("Please select a badge to award.");
      return;
    }
    setPendingAction({ kind: "award" });
  };

  // Modals close and `busy` clears in the same synchronous step, so the badge
  // image field unmounts while still marked committed and keeps the upload.
  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    if (!canManage) {
      toast.error("View-only access: your role can view Badges but not make changes.");
      setPendingAction(null);
      return;
    }
    setBusy(true);
    try {
      switch (action.kind) {
        case "saveBadge":
          if (editingBadge) {
            await updateAdminBadge(editingBadge.id, {
              name: badgeForm.name,
              description: badgeForm.description,
              icon: badgeForm.icon,
              color_scheme: badgeForm.color_scheme,
              category: badgeForm.category,
            });
          } else {
            await createAdminBadge(badgeForm);
          }
          toast.success(
            editingBadge
              ? "Badge updated successfully."
              : "New badge created successfully.",
          );
          setShowBadgeModal(false);
          setEditingBadge(null);
          break;
        case "award":
          if (!selectedPlayer) return;
          await awardAdminBadge({
            player_id: selectedPlayer.id,
            badge_id: awardBadgeId,
            competition_id: awardCompId || undefined,
            season: awardSeason || undefined,
            event_day_id: awardEventDayId || undefined,
            reason: awardReason || undefined,
            count: awardCount || 1,
          });
          toast.success(
            `Badge successfully awarded to ${selectedPlayer.name}!`,
          );
          setShowAwardModal(false);
          setSelectedPlayer(null);
          setAwardReason("");
          setAwardCount(1);
          break;
        case "deleteBadge":
          await deleteAdminBadge(action.badge.id);
          toast.success("Badge removed from catalog.");
          break;
        case "revoke":
          await deleteAdminBadgeAward(action.award.id);
          toast.success("Award revoked and player badge counter decremented.");
          break;
        case "backfill": {
          const data = await backfillMVPBadges();
          toast.success(
            `${data.message} (${data.updated_players} players updated with their historical match MVPs).`,
          );
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["adminBadges"] });
      queryClient.invalidateQueries({ queryKey: ["adminBadgeAwards"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, FAILURE[action.kind]));
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const openCreateBadge = () => {
    setEditingBadge(null);
    setBadgeForm({
      code: "",
      name: "",
      description: "",
      icon: "",
      color_scheme: "gold",
      category: "Honors",
    });
    setShowBadgeModal(true);
  };

  const openEditBadge = (badge: Badge) => {
    setEditingBadge(badge);
    setBadgeForm({
      code: badge.code,
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon || "",
      color_scheme: badge.color_scheme || "gold",
      category: badge.category || "Honors",
    });
    setShowBadgeModal(true);
  };

  const openAwardModal = (defaultBadgeId?: string) => {
    setSelectedPlayer(null);
    setPlayerSearchQuery("");
    setAwardBadgeId(defaultBadgeId || badges[0]?.id || "");
    setAwardCompId(competitions[0]?.id || "");
    setAwardEventDayId("");
    setAwardSeason(new Date().getFullYear().toString());
    setAwardReason("");
    setAwardCount(1);
    setShowAwardModal(true);
  };

  const awardColumns = useMemo<Column<PlayerBadgeAward>[]>(
    () => [
      {
        header: "Player",
        sortable: true,
        sortValue: (a) => a.player?.name ?? "",
        cell: (award) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
              {award.player?.image ? (
                <img
                  src={award.player.image}
                  alt={award.player.name}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                  #{award.player?.jersey_number || "?"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-black text-sffl-navy dark:text-white truncate">
                {award.player?.name || "Player"}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {award.player?.position}{" "}
                {award.player?.team?.name && `• ${award.player.team.name}`}
              </div>
            </div>
          </div>
        ),
      },
      {
        header: "Badge",
        sortable: true,
        sortValue: (a) => a.badge?.name ?? "",
        cell: (award) => (
          <div className="flex items-center gap-2">
            <BadgeImage
              icon={award.badge?.icon}
              name={award.badge?.name}
              className="w-6 h-6 text-xl shrink-0"
            />
            <span className="font-bold text-gray-900 dark:text-white">
              {award.badge?.name || "Badge"}
            </span>
          </div>
        ),
      },
      {
        header: "Season / Context",
        cell: (award) => (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {awardContext(award)}
          </span>
        ),
      },
      {
        header: "Reason / Note",
        cell: (award) => (
          <span className="block max-w-xs wrap-break-word text-xs text-gray-500 dark:text-gray-400">
            {award.reason || "—"}
          </span>
        ),
      },
      {
        header: "Date Awarded",
        sortable: true,
        sortValue: (a) => a.created_at,
        cell: (award) => (
          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
            {formatAwardDate(award.created_at)}
          </span>
        ),
      },
      {
        header: "Actions",
        align: "right",
        cell: (award) => (
          <RowActions
            label={`Actions for ${award.player?.name || "player"}'s ${award.badge?.name || "badge"} award`}
            actions={[
              isAutomaticAward(award)
                ? {
                    label: "Revoke award",
                    icon: TrashIcon,
                    disabled: true,
                    hint: award.totw_id
                      ? "Comes from a Team of the Week edition. Remove the player from it or unpublish it to revoke."
                      : "Comes from the match MVP. Change the MVP on the match to revoke.",
                  }
                : {
                    label: "Revoke award",
                    icon: TrashIcon,
                    danger: true,
                    disabled: !canManage,
                    hint: canManage ? undefined : "View-only access to Badges",
                    onSelect: () => setPendingAction({ kind: "revoke", award }),
                  },
            ]}
          />
        ),
      },
    ],
    [canManage],
  );

  const dialog = (() => {
    switch (pendingAction?.kind) {
      case "award":
        return {
          title: "Award this badge?",
          description:
            "This increments the player's accolade counter and logs an audit record.",
          confirmLabel: "Award Honor",
          tone: "success" as const,
          icon: GiftIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Player", selectedPlayer?.name],
                ["Badge", selectedBadge?.name],
                ["Count", String(awardCount || 1)],
                [
                  "Competition",
                  competitions.find((c) => c.id === awardCompId)?.name ||
                    "None / General",
                ],
                ["Season", awardSeason],
                ["Reason", awardReason],
              ]}
            />
          ),
        };
      case "deleteBadge":
        return {
          title: "Delete this badge?",
          description: "Player accolades attached to it will be removed.",
          confirmLabel: "Delete Badge",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Badge", pendingAction.badge.name],
                ["Code", pendingAction.badge.code],
                ["Category", pendingAction.badge.category || "Honors"],
              ]}
            />
          ),
        };
      case "revoke":
        return {
          title: "Revoke this award?",
          description: "This decrements the player's badge counter.",
          confirmLabel: "Revoke Award",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Player", pendingAction.award.player?.name || "Player"],
                ["Badge", pendingAction.award.badge?.name || "Badge"],
                ["Context", awardContext(pendingAction.award)],
                ["Awarded", formatAwardDate(pendingAction.award.created_at)],
              ]}
            />
          ),
        };
      case "backfill":
        return {
          title: "Backfill career MVPs?",
          description:
            "Scans all past matches and adds each match MVP to that player's badge profile.",
          confirmLabel: "Run Backfill",
          tone: "info" as const,
          icon: SparklesIcon,
          body: undefined,
        };
      default:
        return {
          title: editingBadge
            ? "Save changes to this badge?"
            : "Create this badge?",
          description: undefined,
          confirmLabel: editingBadge ? "Save Changes" : "Create Badge",
          tone: "info" as const,
          icon: editingBadge ? PencilSquareIcon : PlusIcon,
          body: (
            <ConfirmSummary
              rows={[
                ["Badge", badgeForm.name],
                ["Code", badgeForm.code],
                ["Category", badgeForm.category],
                [
                  "Color",
                  COLOR_SCHEMES.find(
                    (cs) => cs.value === badgeForm.color_scheme,
                  )?.label,
                ],
              ]}
            />
          ),
        };
    }
  })();

  const systemBadges = badges.filter((b) => b.is_system);
  const customBadges = badges.filter((b) => !b.is_system);

  const tabClass = (active: boolean) =>
    `px-4 min-h-11 text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
      active
        ? "bg-sffl-red text-white shadow-sm"
        : "bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
    }`;

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-16">
      <DashboardPageHeader
        title="Badges & Honors"
        subtitle="Manage player accolades, MVP counters, Team of the Week/Season badges, and custom league honors."
        actions={
          <>
            <button
              type="button"
              onClick={() => setPendingAction({ kind: "backfill" })}
              disabled={busy || !canManage}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title={canManage ? "Scan finished 2026 matches and award MVP badges to players" : "View-only access to Badges"}
            >
              <SparklesIcon className="w-4 h-4" />
              <span>
                {busy && pendingAction?.kind === "backfill"
                  ? "Backfilling…"
                  : "Backfill 2026 MVPs"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openAwardModal()}
              className="px-4 min-h-11 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-sffl-navy dark:text-white border border-gray-300 dark:border-gray-600 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <GiftIcon className="w-4 h-4 text-sffl-red" aria-hidden="true" />
              <span>Award Badge</span>
            </button>
            <button
              type="button"
              onClick={openCreateBadge}
              className="px-4 min-h-11 bg-sffl-red hover:bg-[#A52323] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>Create Badge</span>
            </button>
          </>
        }
      />

      {/* Accolade Overview Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="text-2xl md:text-3xl font-black text-sffl-navy dark:text-white">
            {systemBadges.length}
          </div>
          <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
            System Badges
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="text-2xl md:text-3xl font-black text-sffl-red">
            {customBadges.length}
          </div>
          <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
            Custom Badges
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="text-2xl md:text-3xl font-black text-amber-500">
            {awards.length}
          </div>
          <div className="text-[10px] md:text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
            Total Awards Logged
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col justify-center">
          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Auto-Sync Active</span>
          </div>
          <div className="text-[10px] font-bold text-gray-400 mt-1">
            Match MVPs & TOTWs auto-increment
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          aria-pressed={activeTab === "catalog"}
          className={tabClass(activeTab === "catalog")}
        >
          Badge Catalog ({badges.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("awards")}
          aria-pressed={activeTab === "awards"}
          className={tabClass(activeTab === "awards")}
        >
          Award History & Log ({awards.length})
        </button>
      </div>

      {/* ── CATALOG TAB ────────────────────────────────────────────── */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {loadingBadges ? (
            <Loader />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3 min-w-0">
                      <div className="w-14 h-14 p-2 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-inner flex items-center justify-center shrink-0">
                        <BadgeImage
                          icon={b.icon}
                          name={b.name}
                          className="w-10 h-10 text-3xl"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-base text-sffl-navy dark:text-white leading-tight wrap-break-word">
                          {b.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {b.category || "Honors"}
                          </span>
                          {b.is_system && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              System Auto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                      {b.description || "No description provided."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[10px] font-mono text-gray-400 font-bold uppercase">
                      CODE: {b.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openAwardModal(b.id)}
                        className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-bold text-sffl-red bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                      >
                        <GiftIcon className="w-4 h-4" aria-hidden="true" />
                        Award
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditBadge(b)}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                        aria-label={`Edit ${b.name}`}
                      >
                        <PencilSquareIcon
                          className="w-5 h-5"
                          aria-hidden="true"
                        />
                      </button>
                      {!b.is_system && (
                        <button
                          type="button"
                          disabled={!canManage}
                          title={canManage ? undefined : "View-only access to Badges"}
                          onClick={() =>
                            setPendingAction({ kind: "deleteBadge", badge: b })
                          }
                          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Delete ${b.name}`}
                        >
                          <TrashIcon className="w-5 h-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AWARDS AUDIT LOG TAB ────────────────────────────────────── */}
      {activeTab === "awards" && (
        <DataTable
          data={awards}
          columns={awardColumns}
          getRowId={(a) => a.id}
          loading={loadingAwards}
          searchable={false}
          emptyMessage="No badge awards recorded yet. Awards are logged when you manually award a badge or when match MVPs and TOTWs are synced."
        />
      )}

      {/* ── CREATE / EDIT BADGE MODAL ──────────────────────────────── */}
      {showBadgeModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in"
          data-dialog
          onClick={() => setShowBadgeModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                  {editingBadge ? "Edit Badge" : "Create Badge"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Select an official Showtime badge design or upload custom
                  artwork
                </p>
              </div>
              <button
                onClick={() => setShowBadgeModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1">
              {/* ── Official Badge Presets Gallery ──────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Official Showtime Badges (Click to Select) *
                  </label>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    10 official emblems
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
                  {OFFICIAL_BADGE_PRESETS.map((preset) => {
                    const isSelected =
                      badgeForm.icon === preset.imageUrl ||
                      badgeForm.icon === preset.localUrl ||
                      badgeForm.icon?.endsWith(preset.filename);
                    return (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => {
                          setBadgeForm((p) => ({
                            ...p,
                            icon: preset.imageUrl,
                            name:
                              !editingBadge || !p.name ? preset.name : p.name,
                            code:
                              !editingBadge && !p.code ? preset.code : p.code,
                            category: preset.category,
                            color_scheme: preset.color_scheme,
                            description: !p.description
                              ? preset.description
                              : p.description,
                          }));
                        }}
                        className={`group relative p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-400/50 shadow-md"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:scale-[1.02]"
                        }`}
                      >
                        <div className="w-12 h-12 flex items-center justify-center p-1">
                          <img
                            src={preset.localUrl}
                            alt={preset.name}
                            className="w-full h-full object-contain drop-shadow-xs"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                preset.imageUrl;
                            }}
                          />
                        </div>
                        <span className="mt-1.5 text-[10px] font-black leading-tight text-gray-900 dark:text-gray-100 line-clamp-2">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-sffl-navy flex items-center justify-center text-[10px] font-black shadow-xs">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Active Emblem Preview & Custom Upload ───────── */}
              <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                {badgeForm.icon ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-400/40">
                    <div className="w-14 h-14 p-1 rounded-xl bg-white dark:bg-gray-800 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-sm">
                      <BadgeImage
                        icon={badgeForm.icon}
                        name="Preview"
                        className="w-full h-full text-2xl"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                          {badgeForm.name || "Selected Badge"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400/20 text-amber-700 dark:text-amber-300">
                          Active Artwork
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-mono mt-0.5">
                        {badgeForm.icon}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-center text-xs text-gray-500 dark:text-gray-400">
                    No emblem selected. Click one of the official badges above
                    or upload custom artwork below.
                  </div>
                )}

                <ImageUploadField
                  label="Or Upload Custom Badge Artwork to R2"
                  value={badgeForm.icon || ""}
                  onChange={(url) => setBadgeForm((p) => ({ ...p, icon: url }))}
                  folder="badges"
                  helperText="Upload a crisp square badge emblem (PNG, WebP, SVG with transparent background recommended)"
                />
              </div>

              {/* ── Badge Metadata ─────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                {!editingBadge && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                      Badge Code (Unique ID) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GAME_MVP"
                      value={badgeForm.code}
                      onChange={(e) =>
                        setBadgeForm((p) => ({
                          ...p,
                          code: e.target.value
                            .toUpperCase()
                            .replace(/\s+/g, "_"),
                        }))
                      }
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-sffl-red"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                    Badge Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Game MVP"
                    value={badgeForm.name}
                    onChange={(e) =>
                      setBadgeForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={badgeForm.category}
                    onChange={(e) =>
                      setBadgeForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                  >
                    <option value="Honors">Honors</option>
                    <option value="Match Honor">Match Honor</option>
                    <option value="Weekly Honor">Weekly Honor</option>
                    <option value="Season Honor">Season Honor</option>
                    <option value="Tournament Honor">Tournament Honor</option>
                    <option value="Offence">Offence</option>
                    <option value="Defence">Defence</option>
                    <option value="Milestone">Milestone</option>
                    <option value="Special">Special Award</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1">
                    Color Theme
                  </label>
                  <select
                    value={badgeForm.color_scheme}
                    onChange={(e) =>
                      setBadgeForm((p) => ({
                        ...p,
                        color_scheme: e.target.value,
                      }))
                    }
                    className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                  >
                    {COLOR_SCHEMES.map((cs) => (
                      <option key={cs.value} value={cs.value}>
                        {cs.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={fieldLabelClass}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the criteria or achievement required for this honor..."
                  value={badgeForm.description}
                  onChange={(e) =>
                    setBadgeForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sffl-red"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBadgeModal(false)}
                className="px-4 min-h-11 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestSaveBadge}
                disabled={
                  busy ||
                  !badgeForm.name.trim() ||
                  !(badgeForm.icon || "").trim() ||
                  (!editingBadge && !badgeForm.code.trim())
                }
                className="px-5 min-h-11 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer disabled:opacity-50"
              >
                {editingBadge ? "Save Changes" : "Create Badge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL AWARD MODAL ─────────────────────────────────────── */}
      {showAwardModal && (
        <div
          className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in"
          data-dialog
          onClick={() => setShowAwardModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-sffl-navy dark:text-white">
                  Award Badge to Player
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Increments the player's accolade counter and logs audit record
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAwardModal(false)}
                aria-label="Close"
                className={closeButtonClass}
              >
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {/* Player Selector */}
              <div>
                <label className={fieldLabelClass}>Target Player *</label>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden shrink-0">
                        {selectedPlayer.image ? (
                          <img
                            src={selectedPlayer.image}
                            alt={selectedPlayer.name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-xs text-gray-400">
                            #{selectedPlayer.jersey_number || "?"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-sm text-sffl-navy dark:text-white truncate">
                          {selectedPlayer.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {selectedPlayer.position} •{" "}
                          {selectedPlayer.team?.name || "Free Agent"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(null)}
                      className="shrink-0 px-2 min-h-11 text-xs font-bold text-sffl-red hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <MagnifyingGlassIcon
                        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        placeholder="Search player name"
                        aria-label="Search player name"
                        value={playerSearchQuery}
                        onChange={(e) => setPlayerSearchQuery(e.target.value)}
                        className="w-full min-h-11 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sffl-red"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {loadingPlayers ? (
                        <Spinner size="sm" className="py-4" />
                      ) : availablePlayers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">
                          No players found
                        </div>
                      ) : (
                        availablePlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPlayer(p)}
                            className="w-full min-h-11 flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/60 text-left text-xs cursor-pointer"
                          >
                            <span className="min-w-0 truncate font-bold text-gray-900 dark:text-white">
                              {p.name} ({p.position})
                            </span>
                            <span className="shrink-0 text-[11px] text-gray-400">
                              {p.team?.short_name ||
                                p.team?.name ||
                                "Free Agent"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Badge Selection */}
              <div>
                <label className={fieldLabelClass}>
                  Honor / Badge to Award *
                </label>
                <select
                  value={awardBadgeId}
                  onChange={(e) => setAwardBadgeId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select Badge</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                {selectedBadge && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 mt-2">
                    <div className="w-10 h-10 p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0 shadow-xs">
                      <BadgeImage
                        icon={selectedBadge.icon}
                        name={selectedBadge.name}
                        className="w-full h-full text-xl"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-sffl-navy dark:text-white truncate">
                        {selectedBadge.name}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {selectedBadge.description || "No description"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Context: Competition & Season */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabelClass}>Competition</label>
                  <select
                    value={awardCompId}
                    onChange={(e) => setAwardCompId(e.target.value)}
                    className={`${fieldClass} text-xs`}
                  >
                    <option value="">None / General</option>
                    {competitions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabelClass}>Season Year</label>
                  <input
                    type="text"
                    value={awardSeason}
                    onChange={(e) => setAwardSeason(e.target.value)}
                    placeholder="2026"
                    className={`${fieldClass} text-xs`}
                  />
                </div>
              </div>

              {/* Optional Event Day */}
              <div>
                <label className={fieldLabelClass}>
                  Linked Event Day (Optional)
                </label>
                <select
                  value={awardEventDayId}
                  onChange={(e) => setAwardEventDayId(e.target.value)}
                  className={`${fieldClass} text-xs`}
                >
                  <option value="">None</option>
                  {eventDays.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.title || ed.date} (
                      {new Date(ed.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Count & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={fieldLabelClass}>Add Count</label>
                  <input
                    type="number"
                    min="1"
                    value={awardCount}
                    onChange={(e) =>
                      setAwardCount(parseInt(e.target.value) || 1)
                    }
                    className={`${fieldClass} text-xs text-center`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabelClass}>
                    Award Reason / Citation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 Touchdown performance"
                    value={awardReason}
                    onChange={(e) => setAwardReason(e.target.value)}
                    className={`${fieldClass} text-xs`}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAwardModal(false)}
                className="px-4 min-h-11 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={requestAward}
                disabled={busy || !selectedPlayer || !awardBadgeId}
                className="px-5 min-h-11 bg-sffl-red hover:bg-[#A52323] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer disabled:opacity-50"
              >
                Award Honor
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog.title}
        description={dialog.description}
        body={dialog.body}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        icon={dialog.icon}
        pending={busy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
