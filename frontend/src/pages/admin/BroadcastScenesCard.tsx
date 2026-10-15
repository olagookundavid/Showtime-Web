import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  BackwardIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  ForwardIcon,
  PlayIcon,
  PresentationChartBarIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StopIcon,
  TableCellsIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../../components";
import { useBroadcastScenes } from "../../hooks";
import type { BroadcastScene, BroadcastState } from "../../types";
import { buildSceneLineup } from "../broadcastScenes";

// Seconds each starter holds the screen when introductions auto-play.
const AUTO_PLAY_HOLD_MS = 4000;

const SCENES: {
  value: BroadcastScene;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { value: "opening", label: "Opening matchup", hint: "Both clubs, records, venue and kickoff", icon: SparklesIcon },
  { value: "attack", label: "Attack & possession", hint: "Plays, yards, completions, catches, drops, turnovers, punts, touchdowns", icon: PresentationChartBarIcon },
  { value: "defence", label: "Defence & discipline", hint: "Flag pulls, interceptions, bat downs, sacks, infractions, pick sixes", icon: ShieldCheckIcon },
  { value: "standings", label: "Standings", hint: "The competition table, counting live scores", icon: TableCellsIcon },
  { value: "lineup", label: "Starting lineup", hint: "Both starting units on the field, with benches", icon: UserGroupIcon },
];

interface Props {
  state: BroadcastState;
  updateFields: (patch: Partial<BroadcastState>) => void;
}

/**
 * Full-screen scenes on the studio: put one on air, take it off, and run the
 * starting-lineup introductions. Scenes show on the scenes layer (and the
 * combined one); the scorebug steps aside while one is up.
 */
export function BroadcastScenesCard({ state, updateFields }: Props) {
  const { data, isLoading, isError } = useBroadcastScenes(state.match_id, true);
  const [autoPlay, setAutoPlay] = useState(false);

  // 'facts' (the single stats scene before attack and defence were split) is the attack scene.
  const scene = state.scene === "facts" ? "attack" : state.scene || "";
  const attackSide = state.lineup_attack ?? "home";
  const intro = state.lineup_intro ?? null;
  const lineup = useMemo(() => (data ? buildSceneLineup(data, attackSide) : null), [data, attackSide]);
  const total = lineup?.nodes.length ?? 0;
  const introRunning = scene === "lineup" && !!intro && intro.cursor < total;
  const current = introRunning && lineup ? lineup.nodes.at(intro.cursor) : undefined;

  const setCursor = (cursor: number) =>
    updateFields({ scene: "lineup", lineup_intro: { cursor: Math.max(0, Math.min(cursor, total)) } });

  // Auto-play: this studio advances one starter every few seconds and stops at
  // the end. Only the studio that started it runs the timer, so a second open
  // studio can't double the pace.
  useEffect(() => {
    if (!autoPlay || !introRunning || !intro) return;
    const timer = setTimeout(() => {
      const next = intro.cursor + 1;
      updateFields({ scene: "lineup", lineup_intro: { cursor: Math.min(next, total) } });
      if (next >= total) setAutoPlay(false);
    }, AUTO_PLAY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [autoPlay, introRunning, intro, total, updateFields]);

  const showScene = (value: BroadcastScene) => {
    setAutoPlay(false);
    // The lineup goes up whole; introductions start from their own button.
    updateFields({ scene: value, lineup_intro: null });
  };

  const takeOff = () => {
    setAutoPlay(false);
    updateFields({ scene: "", lineup_intro: null });
  };

  const unavailable = (value: BroadcastScene): string | undefined => {
    if (!data) return isLoading ? "Loading match data" : "Match data unavailable";
    if (value === "standings" && data.standings.length === 0) return "This competition has no table";
    if (value === "lineup" && total === 0) return "Neither team has players to show yet";
    return undefined;
  };

  const sheetWarnings = data
    ? [data.home, data.away].flatMap((team) => {
        if (team.players.length === 0) return [`${team.name} has no team sheet or squad yet.`];
        const starters = team.players.filter((p) => p.is_starter).length;
        return starters === 0 ? [`${team.name} hasn't named starters: its lineup is projected from the squad.`] : [];
      })
    : [];

  const onAirLabel = SCENES.find((s) => s.value === scene)?.label;
  const homeShort = data?.home.short || data?.home.name || state.home;
  const awayShort = data?.away.short || data?.away.name || state.away;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="min-w-0">
          <h2 className="font-black text-gray-900 dark:text-white text-base md:text-lg tracking-tight">
            Full-screen scenes
          </h2>
          <p className="text-xs text-gray-500">
            {onAirLabel ? (
              <>
                On air: <b className="text-gray-800 dark:text-gray-100">{onAirLabel}</b>. The scorebug steps aside
                until it comes off.
              </>
            ) : (
              "Nothing on air. Scenes fill the screen; the scorebug steps aside while one is up."
            )}
          </p>
        </div>
        <Button variant="secondary" icon={EyeSlashIcon} onClick={takeOff} disabled={!scene}>
          Take scene off air
        </Button>
      </div>

      {isError && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          The match data for scenes couldn't be loaded. Scenes stay blank on air until it can.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SCENES.map((s) => {
          const reason = unavailable(s.value);
          const live = scene === s.value;
          return (
            <Button
              key={s.value}
              variant={live ? "danger" : "navy"}
              icon={live ? CheckIcon : s.icon}
              onClick={() => showScene(s.value)}
              disabled={!!reason}
              title={reason ?? s.hint}
              aria-pressed={live}
              fullWidth
            >
              {live ? `${s.label} · on air` : s.label}
            </Button>
          );
        })}
      </div>

      {/* Starting lineup */}
      <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Starting lineup</h3>
          <p className="text-xs text-gray-500">
            Pick the team attacking, then introduce each starter in turn: they appear centre stage, then move to their
            spot.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Team attacking">
          {(["home", "away"] as const).map((side) => (
            <Button
              key={side}
              size="sm"
              variant={attackSide === side ? "navy" : "secondary"}
              aria-pressed={attackSide === side}
              onClick={() => {
                setAutoPlay(false);
                // Switching sides restarts any introductions for the new lineup.
                updateFields({ lineup_attack: side, lineup_intro: introRunning ? { cursor: 0 } : intro });
              }}
            >
              {side === "home" ? homeShort : awayShort} attacking
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={PlayIcon}
            onClick={() => {
              setAutoPlay(false);
              setCursor(0);
            }}
            disabled={total === 0}
          >
            {introRunning ? "Restart introductions" : "Start introductions"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={BackwardIcon}
            onClick={() => intro && setCursor(intro.cursor - 1)}
            disabled={!introRunning || !intro || intro.cursor === 0}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={ForwardIcon}
            onClick={() => intro && setCursor(intro.cursor + 1)}
            disabled={!introRunning}
          >
            Next player
          </Button>
          <Button
            size="sm"
            variant={autoPlay ? "warning" : "secondary"}
            icon={autoPlay ? StopIcon : PlayIcon}
            onClick={() => {
              if (autoPlay) {
                setAutoPlay(false);
                return;
              }
              if (!introRunning) setCursor(0);
              setAutoPlay(true);
            }}
            disabled={total === 0}
          >
            {autoPlay ? "Stop auto-play" : "Auto-play"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAutoPlay(false);
              updateFields({ scene: "lineup", lineup_intro: null });
            }}
            disabled={total === 0 || (scene === "lineup" && !introRunning)}
          >
            Show full lineup
          </Button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
          {current && intro
            ? `Introducing ${intro.cursor + 1} of ${total}: ${current.player.name} (${current.roleLong}).`
            : scene === "lineup"
              ? "Full lineup on air."
              : `${total} starters ready.`}
        </p>

        {sheetWarnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}
