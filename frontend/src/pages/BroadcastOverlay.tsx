import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBroadcastViewer } from '../hooks';
import { calculateClockNow, formatClock, type GraphicEvent } from '../types';
import './BroadcastOverlay.css';

export function BroadcastOverlay() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = matchId || '';

  const { state } = useBroadcastViewer(id);
  const [scale, setScale] = useState({ k: 1, x: 0, y: 0 });

  // Ticks while the clock runs so the countdown re-renders smoothly
  const [now, setNow] = useState(() => Date.now());

  // Exit phase of the current graphic. A graphic whose id isn't recorded here is entering.
  const [graphicExit, setGraphicExit] = useState<{ id: number; stage: 'out' | 'hidden' } | null>(null);

  // Set body to transparent overlay mode
  useEffect(() => {
    const origBg = document.body.style.backgroundColor;
    const origOverflow = document.body.style.overflow;
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden';

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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tick the running clock
  const clockRunning = state?.clock_running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [clockRunning]);

  // Schedule the exit of each new graphic after its duration
  const graphicId = state?.graphic ? state.graphic_id : 0;
  const graphicDuration = state?.graphic?.duration || 5500;
  useEffect(() => {
    if (!graphicId) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const outTimer = setTimeout(() => {
      setGraphicExit({ id: graphicId, stage: 'out' });
      hideTimer = setTimeout(() => setGraphicExit({ id: graphicId, stage: 'hidden' }), 350);
    }, graphicDuration);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(hideTimer);
    };
  }, [graphicId, graphicDuration]);

  if (!state) {
    return <div className="broadcast-canvas" style={{ background: 'transparent' }} />;
  }

  const clockDisplay = formatClock(calculateClockNow(state, now));

  const exitStage = graphicExit?.id === graphicId ? graphicExit.stage : null;
  const activeGraphic: GraphicEvent | null = state.graphic && exitStage !== 'hidden' ? state.graphic : null;
  const animClass = exitStage ?? 'enter';

  const downText = state.down?.endsWith('G')
    ? `${['1ST', '2ND', '3RD', '4TH'][parseInt(state.down[0], 10) - 1] || '—'} & GOAL`
    : `${['1ST', '2ND', '3RD', '4TH'][parseInt(state.down, 10) - 1] || '—'} DOWN`;

  const initials = activeGraphic?.player
    ? activeGraphic.player
        .split(' ')
        .map((x) => x[0])
        .slice(0, 2)
        .join('')
    : activeGraphic?.team
    ? activeGraphic.team.slice(0, 2).toUpperCase()
    : 'S';

  return (
    <div
      className="broadcast-canvas"
      style={{
        transform: `translate(${scale.x}px, ${scale.y}px) scale(${scale.k})`,
        transformOrigin: 'top left',
      }}
    >
      {/* 1. Scorebug (Persistent top-left on-air display) */}
      <div className={`scorebug-container ${!state.scorebug ? 'off' : ''}`}>
        <div className="scorebug-main">
          {/* Showtime Badge Logo */}
          <div className="bug-logo">
            <img src="/showtime-broadcast-logo.png" alt="Showtime" />
          </div>

          {/* Home Team */}
          <div className="bug-team home">
            <small>HOME</small>
            <strong title={state.home}>{state.home}</strong>
          </div>

          {/* Home Score */}
          <div className="bug-score">
            <span>{state.manual_home}</span>
            <div className="timeout-dots">
              {[0, 1, 2].map((idx) => (
                <i key={idx} className={idx < state.timeouts_home ? 'live' : ''} />
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
                <i key={idx} className={idx < state.timeouts_away ? 'live' : ''} />
              ))}
            </div>
          </div>

          {/* Away Team */}
          <div className="bug-team away">
            <small>AWAY</small>
            <strong title={state.away}>{state.away}</strong>
          </div>
        </div>

        {/* Down & Ball Possession Pill */}
        <div className="bug-detail-pill">
          <span>{downText}</span>
          <span>BALL: {state.possession}</span>
        </div>
      </div>

      {/* 2. Lower-Third Graphic Banner */}
      {activeGraphic && (
        <div
          key={graphicId}
          className={`graphic-banner ${animClass} ${activeGraphic.compact ? 'compact-mode' : ''} ${
            !activeGraphic.player ? 'no-avatar' : ''
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
            <div className={`graphic-call ${activeGraphic.type.length > 12 ? 'long' : ''}`}>
              {activeGraphic.type}
            </div>
            {activeGraphic.player && (
              <div className="graphic-player-name">{activeGraphic.player}</div>
            )}
            {activeGraphic.stat && <div className="graphic-stat-line">{activeGraphic.stat}</div>}
          </div>

          <div className="graphic-tag">SHOWTIME FLAG</div>
          <img src="/showtime-broadcast-logo.png" alt="Showtime" className="graphic-corner-logo" />
        </div>
      )}
    </div>
  );
}

export default BroadcastOverlay;
