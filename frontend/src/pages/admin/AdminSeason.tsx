import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  getAdminSeasonGraphics,
  upsertSeasonGraphic,
  getAdminSeasonMVPs,
  createSeasonMVP,
  updateSeasonMVP,
  deleteSeasonMVP,
  getPlayers,
} from "../../services/api";
import type { SeasonMVP } from "../../types/teamOfSeason";
import type { Player } from "../../types/players";
import { Loader } from "../../components/ui/Loader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ConfirmSummary } from "../../components/ui/ConfirmSummary";
import { Button, Field, IconButton, ImageUploadField, Input } from "../../components/ui";
import { DashboardPageHeader } from "../../components/dashboard/DashboardPageHeader";

type Cat = "offense" | "defense";
type GraphicState = { image_url: string; mobile_image_url: string };

// Every MVP change waits for the confirm dialog first.
type PendingAction =
  | { kind: "add" }
  | { kind: "move"; mvp: SeasonMVP; direction: "up" | "down" }
  | { kind: "toggle"; mvp: SeasonMVP }
  | { kind: "delete"; mvp: SeasonMVP };

export const AdminSeason = () => {
  const queryClient = useQueryClient();

  const { data: graphics = [], isLoading: gLoading } = useQuery({
    queryKey: ["adminSeasonGraphics"],
    queryFn: getAdminSeasonGraphics,
  });
  const { data: mvps = [], isLoading: mLoading } = useQuery({
    queryKey: ["adminSeasonMVPs"],
    queryFn: getAdminSeasonMVPs,
  });

  // Derive the displayed values from the server response and retain only
  // local edits, avoiding a state update during effect synchronization.
  const serverState = useMemo(() => {
    const next: Record<Cat, GraphicState> = {
      offense: { image_url: "", mobile_image_url: "" },
      defense: { image_url: "", mobile_image_url: "" },
    };
    for (const g of graphics) {
      next[g.category] = {
        image_url: g.image_url,
        mobile_image_url: g.mobile_image_url || "",
      };
    }
    return next;
  }, [graphics]);
  const [graphicEdits, setGraphicEdits] = useState<
    Partial<Record<Cat, GraphicState>>
  >({});
  const state = useMemo(
    () => ({
      offense: graphicEdits.offense || serverState.offense,
      defense: graphicEdits.defense || serverState.defense,
    }),
    [graphicEdits, serverState],
  );

  const refreshGraphics = () =>
    queryClient.invalidateQueries({ queryKey: ["adminSeasonGraphics"] });
  const refreshMVPs = () =>
    queryClient.invalidateQueries({ queryKey: ["adminSeasonMVPs"] });

  // Persist a graphic whenever its desktop or mobile image changes. Desktop
  // image is required by the API, so we only save once one is present.
  const saveGraphic = async (
    category: Cat,
    field: keyof GraphicState,
    url: string,
  ) => {
    const merged = { ...state[category], [field]: url };
    setGraphicEdits((prev) => ({ ...prev, [category]: merged }));
    if (!merged.image_url) return; // wait for a desktop image before saving
    await upsertSeasonGraphic({
      category,
      image_url: merged.image_url,
      mobile_image_url: merged.mobile_image_url || undefined,
    });
    refreshGraphics();
  };

  // ── MVP add form ──
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: playerResults, isLoading: searching } = useQuery({
    queryKey: ["seasonPlayerSearch", search],
    queryFn: () => getPlayers(undefined, 1, 15, search),
    enabled: search.trim().length >= 2,
  });
  const foundPlayers = playerResults?.data || [];

  // Close the results dropdown when clicking outside the search box.
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleAddMVP = async () => {
    if (!selected) {
      setError("Pick a player");
      return;
    }
    if (!label.trim()) {
      setError("Enter a label (e.g. Offensive MVP)");
      return;
    }
    setAdding(true);
    setError("");
    try {
      await createSeasonMVP({
        player_id: selected.id,
        label: label.trim(),
        display_order: mvps.length,
      });
      refreshMVPs();
      setSelected(null);
      setSearch("");
      setLabel("");
    } catch (err: unknown) {
      const responseError =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof err.response === "object" &&
        err.response !== null &&
        "data" in err.response &&
        typeof err.response.data === "object" &&
        err.response.data !== null &&
        "error" in err.response.data &&
        typeof err.response.data.error === "string"
          ? err.response.data.error
          : undefined;
      setError(responseError || "Failed to add MVP");
    }
    setAdding(false);
  };

  const handleMove = async (mvp: SeasonMVP, direction: "up" | "down") => {
    const idx = mvps.findIndex((m) => m.id === mvp.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= mvps.length) return;
    const other = mvps[swapIdx];
    await Promise.all([
      updateSeasonMVP(mvp.id, { display_order: other.display_order }),
      updateSeasonMVP(other.id, { display_order: mvp.display_order }),
    ]);
    refreshMVPs();
  };

  const handleToggle = async (mvp: SeasonMVP) => {
    await updateSeasonMVP(mvp.id, { is_active: !mvp.is_active });
    refreshMVPs();
  };

  const handleDeleteMVP = async (id: string) => {
    await deleteSeasonMVP(id);
    refreshMVPs();
  };

  // Runs once the admin confirms. The add flow reports its own error inline;
  // anything else is reported with a toast, and the dialog always closes.
  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "add") await handleAddMVP();
      else if (action.kind === "move") await handleMove(action.mvp, action.direction);
      else if (action.kind === "toggle") await handleToggle(action.mvp);
      else await handleDeleteMVP(action.mvp.id);
    } catch {
      toast.error("That change didn't save. Please try again.");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  const dialog = (() => {
    switch (pendingAction?.kind) {
      case "add":
        return {
          title: "Add this MVP?",
          description: "They will appear on the homepage in the last position.",
          confirmLabel: "Add MVP",
          tone: "info" as const,
          icon: StarIcon,
          body: (
            <ConfirmSummary rows={[
              ["Player", selected?.name],
              ["Label", label.trim()],
            ]} />
          ),
        };
      case "move":
        return {
          title: `Move this MVP ${pendingAction.direction}?`,
          description: "The order on the homepage changes straight away.",
          confirmLabel: "Move MVP",
          tone: "info" as const,
          icon: pendingAction.direction === "up" ? ArrowUpIcon : ArrowDownIcon,
          body: (
            <ConfirmSummary rows={[
              ["Player", pendingAction.mvp.player_name],
              ["Label", pendingAction.mvp.label],
            ]} />
          ),
        };
      case "toggle":
        return {
          title: pendingAction.mvp.is_active
            ? "Hide this MVP on the homepage?"
            : "Show this MVP on the homepage?",
          description: undefined,
          confirmLabel: pendingAction.mvp.is_active ? "Hide MVP" : "Show MVP",
          tone: "warning" as const,
          icon: pendingAction.mvp.is_active ? EyeSlashIcon : EyeIcon,
          body: (
            <ConfirmSummary rows={[
              ["Player", pendingAction.mvp.player_name],
              ["Label", pendingAction.mvp.label],
            ]} />
          ),
        };
      case "delete":
        return {
          title: "Delete this MVP?",
          description: "This action cannot be undone.",
          confirmLabel: "Delete MVP",
          tone: "warning" as const,
          icon: TrashIcon,
          body: (
            <ConfirmSummary rows={[
              ["Player", pendingAction.mvp.player_name],
              ["Label", pendingAction.mvp.label],
            ]} />
          ),
        };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-10">
      <DashboardPageHeader
        title="Team of the Season"
        subtitle="Two graphics (Offense & Defense) plus a curated list of MVPs shown on the homepage."
      />

      {/* Graphics */}
      <section className="space-y-4">
        <h2 className="text-xl font-black text-sffl-navy dark:text-white">
          Graphics
        </h2>
        {gLoading ? (
          <Loader />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(["offense", "defense"] as Cat[]).map((cat) => (
              <div
                key={cat}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4"
              >
                <h3 className="font-black uppercase tracking-wider text-sffl-navy dark:text-white">
                  {cat}
                </h3>
                <ImageUploadField
                  label="Desktop Graphic"
                  value={state[cat].image_url}
                  onChange={(url) => saveGraphic(cat, "image_url", url)}
                  folder="season"
                  maxSizeMB={15}
                  compression={{ maxSizeMB: 4, maxWidthOrHeight: 2560 }}
                  helperText="The full Team-of-the-Season graphic (shown as-is, not cropped)."
                  isCommitted
                />
                <ImageUploadField
                  label="Mobile Graphic (optional)"
                  value={state[cat].mobile_image_url}
                  onChange={(url) => saveGraphic(cat, "mobile_image_url", url)}
                  folder="season"
                  maxSizeMB={15}
                  compression={{ maxSizeMB: 3, maxWidthOrHeight: 1440 }}
                  helperText="Optional portrait/square version for phones. Falls back to desktop."
                  isCommitted
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MVPs */}
      <section className="space-y-4">
        <h2 className="text-xl font-black text-sffl-navy dark:text-white">
          MVPs
        </h2>

        {/* Add form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div ref={searchRef} className="md:col-span-2 relative">
              <Field label="Player" htmlFor="mvp-player-search">
                <Input
                  id="mvp-player-search"
                  value={search}
                  autoComplete="off"
                  onChange={(e) => {
                    setSelected(null);
                    setSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (search.trim().length >= 2) setShowDropdown(true);
                  }}
                  placeholder="Search player by name…"
                />
              </Field>
              {selected && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-bold">
                  <CheckIcon className="w-4 h-4" aria-hidden="true" />
                  Selected: {selected.name}
                </p>
              )}
              {showDropdown && search.trim().length >= 2 && (
                <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                  {searching ? (
                    <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      Searching…
                    </p>
                  ) : foundPlayers.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                      No player found for "{search}"
                    </p>
                  ) : (
                    foundPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setSearch(p.name);
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-sm"
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-black">
                            #{p.jersey_number}
                          </span>
                        )}
                        <span className="font-bold text-sffl-navy dark:text-white">
                          {p.name}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {p.position}
                          {p.team?.name ? ` · ${p.team.name}` : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Field label="Label" htmlFor="mvp-label">
              <Input
                id="mvp-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Offensive MVP"
              />
            </Field>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button
            onClick={() => setPendingAction({ kind: "add" })}
            disabled={adding || !selected || !label.trim()}
            loading={adding}
          >
            Add MVP
          </Button>
        </div>

        {/* List */}
        {mLoading ? (
          <Loader />
        ) : mvps.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No MVPs yet.
          </p>
        ) : (
          <div className="space-y-2">
            {mvps.map((mvp, idx) => (
              <div
                key={mvp.id}
                className={`flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border p-3 ${mvp.is_active ? "border-gray-100 dark:border-gray-700" : "border-yellow-300 dark:border-yellow-700"}`}
              >
                {mvp.player_image ? (
                  <img
                    src={mvp.player_image}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-black">
                    #{mvp.player_jersey_number}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sffl-navy dark:text-white truncate">
                    {mvp.player_name}
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs text-sffl-red font-bold uppercase tracking-wide">
                    <StarIcon className="w-3 h-3" aria-hidden="true" />
                    {mvp.label}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={ArrowUpIcon}
                    label="Move up"
                    variant="secondary"
                    disabled={idx === 0 || busy}
                    onClick={() => setPendingAction({ kind: "move", mvp, direction: "up" })}
                  />
                  <IconButton
                    icon={ArrowDownIcon}
                    label="Move down"
                    variant="secondary"
                    disabled={idx === mvps.length - 1 || busy}
                    onClick={() => setPendingAction({ kind: "move", mvp, direction: "down" })}
                  />
                  <Button
                    variant="secondary"
                    icon={mvp.is_active ? EyeSlashIcon : EyeIcon}
                    onClick={() => setPendingAction({ kind: "toggle", mvp })}
                  >
                    {mvp.is_active ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="danger"
                    icon={TrashIcon}
                    onClick={() => setPendingAction({ kind: "delete", mvp })}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        body={dialog?.body}
        confirmLabel={dialog?.confirmLabel ?? "Confirm"}
        tone={dialog?.tone ?? "info"}
        icon={dialog?.icon ?? PencilSquareIcon}
        pending={busy || adding}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
