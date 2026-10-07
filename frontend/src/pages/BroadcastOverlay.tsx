import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useBroadcastViewer } from "../hooks";
import {
  calculateClockNow,
  formatClock,
  type GraphicEvent,
  parseOverlayLayer,
} from "../types";
import { fitTeamName } from "../utils";
import "./BroadcastOverlay.css";

// Inner width of a scorebug team box: 204px less 15px padding each side.
const TEAM_NAME_WIDTH = 174;

/** A club name sized (and if needed split over two lines) to show in full. */
function TeamName({ name }: { name: string }) {
  const fitted = useMemo(() => fitTeamName(name, TEAM_NAME_WIDTH), [name]);
  return (
    <strong title={name} className={fitted.lines.length > 1 ? 'two-line' : ''} style={{ fontSize: fitted.fontSize }}>
      {fitted.lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </strong>
  );
}

export function BroadcastOverlay() {
  // /broadcast/:matchId/overlay follows one match; /broadcast/day/:date/overlay
  // follows whichever match is on air that day.
  const { matchId, date } = useParams<{ matchId?: string; date?: string }>();
  // ?layer=scorebug or ?layer=graphics gives vMix one part per input; no param shows both.
  const [searchParams] = useSearchParams();
  const layer = parseOverlayLayer(searchParams.get("layer"));
  const showScorebug = layer !== "graphics";
  const showGraphics = layer !== "scorebug";

  const { state } = useBroadcastViewer(
    date ? { kind: 'day', date } : { kind: 'match', matchId: matchId || '' },
  );
  const [scale, setScale] = useState({ k: 1, x: 0, y: 0 });

  // Ticks while the clock runs so the countdown re-renders smoothly
  const [now, setNow] = useState(() => Date.now());

  // Exit phase of the current graphic. A graphic whose key isn't recorded here is entering.
  const [graphicExit, setGraphicExit] = useState<{
    key: string;
    stage: "out" | "hidden";
  } | null>(null);

  // Set body to transparent overlay mode
  useEffect(() => {
    const origBg = document.body.style.backgroundColor;
    const origOverflow = document.body.style.overflow;
    document.body.style.backgroundColor = "transparent";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.backgroundColor = origBg;
      document.body.style.overflow = origOverflow;
    };
  }, []);

  // Responsive scale to keep 1920x1080 canvas proportional
  useEffect(() => {
    function handleResize() {
      const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const x = (window.innerWidth - 1920 * k) / 2;
      const y = (window.innerHeight - 1080 * k) / 2;
      setScale({ k, x, y });
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Tick the running clock
  const clockRunning = state?.clock_running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [clockRunning]);

  // Schedule the exit of each new graphic after its duration. Graphic ids count
  // per match, so the key includes the match: an event-day overlay switching
  // matches must not mistake match B's graphic #3 for match A's.
  const graphicKey = state?.graphic ? `${state.match_id}:${state.graphic_id}` : '';
  const graphicDuration = state?.graphic?.duration || 5500;
  useEffect(() => {
    if (!graphicKey) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const outTimer = setTimeout(() => {
      setGraphicExit({ key: graphicKey, stage: "out" });
      hideTimer = setTimeout(
        () => setGraphicExit({ key: graphicKey, stage: "hidden" }),
        350,
      );
    }, graphicDuration);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(hideTimer);
    };
  }, [graphicKey, graphicDuration]);

  if (!state) {
    return (
      <div className="broadcast-canvas" style={{ background: "transparent" }} />
    );
  }

  const clockDisplay = formatClock(calculateClockNow(state, now));

  const exitStage = graphicExit?.key === graphicKey ? graphicExit.stage : null;
  const activeGraphic: GraphicEvent | null =
    state.graphic && exitStage !== "hidden" ? state.graphic : null;
  const animClass = exitStage ?? "enter";

  const downText = state.down?.endsWith("G")
    ? `${["1ST", "2ND", "3RD", "4TH"][parseInt(state.down[0], 10) - 1] || "—"} & GOAL`
    : `${["1ST", "2ND", "3RD", "4TH"][parseInt(state.down, 10) - 1] || "—"} DOWN`;

  const initials = activeGraphic?.player
    ? activeGraphic.player
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
    : activeGraphic?.team
      ? activeGraphic.team.slice(0, 2).toUpperCase()
      : "S";

  return (
    <div
      className="broadcast-canvas"
      style={{
        transform: `translate(${scale.x}px, ${scale.y}px) scale(${scale.k})`,
        transformOrigin: "top left",
      }}
    >
      {/* 1. Scorebug (Persistent top-left on-air display); left out of a lower-thirds-only input */}
      {showScorebug && (
        <div className={`scorebug-container ${!state.scorebug ? "off" : ""}`}>
          <div className="scorebug-main">
            {/* Showtime Badge Logo */}
            <div className="bug-logo">
              <img src="/showtime-broadcast-logo.webp" alt="Showtime" />
            </div>

            {/* Home Team */}
            <div className="bug-team home">
              <small>HOME</small>
              <TeamName name={state.home} />
            </div>

            {/* Home Score */}
            <div className="bug-score">
              <span>{state.manual_home}</span>
              <div className="timeout-dots">
                {[0, 1, 2].map((idx) => (
                  <i
                    key={idx}
                    className={idx < state.timeouts_home ? "live" : ""}
                  />
                ))}
              </div>
            </div>

            {/* Center: Period & Countdown Clock */}
            <div className="bug-middle">
              <b>{state.period}</b>
              <small>{clockDisplay}</small>
            </div>

            {/* Away Score */}
            <div className="bug-score">
              <span>{state.manual_away}</span>
              <div className="timeout-dots">
                {[0, 1, 2].map((idx) => (
                  <i
                    key={idx}
                    className={idx < state.timeouts_away ? "live" : ""}
                  />
                ))}
              </div>
            </div>

            {/* Away Team */}
            <div className="bug-team away">
              <small>AWAY</small>
              <TeamName name={state.away} />
            </div>
          </div>

          {/* Down & Ball Possession Pill */}
          <div className="bug-detail-pill">
            <span>{downText}</span>
            <span>BALL: {state.possession}</span>
          </div>
        </div>
      )}

      {/* 2. Lower-Third Graphic Banner; left out of a scorebug-only input */}
      {showGraphics && activeGraphic && (
        <div
          key={graphicKey}
          className={`graphic-banner ${animClass} ${activeGraphic.compact ? "compact-mode" : ""} ${
            !activeGraphic.player ? "no-avatar" : ""
          }`}
        >
          {/* Avatar / Photo Circle */}
          {activeGraphic.player && (
            <div className="graphic-avatar">
              {activeGraphic.photo ? (
                <img src={activeGraphic.photo} alt={activeGraphic.player} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          )}

          {/* Big Italic Jersey Number */}
          {activeGraphic.number && (
            <div className="graphic-jersey-number">#{activeGraphic.number}</div>
          )}

          {/* Content Column */}
          <div className="graphic-content">
            <div
              className={`graphic-call ${activeGraphic.type.length > 12 ? "long" : ""}`}
            >
              {activeGraphic.type}
            </div>
            {activeGraphic.player && (
              <div className="graphic-player-name">{activeGraphic.player}</div>
            )}
            {activeGraphic.stat && (
              <div className="graphic-stat-line">{activeGraphic.stat}</div>
            )}
          </div>

          <div className="graphic-tag">SHOWTIME FLAG</div>
          <img
            src="/showtime-broadcast-logo.webp"
            alt="Showtime"
            className="graphic-corner-logo"
          />
        </div>
      )}
    </div>
  );
}

export default BroadcastOverlay;
