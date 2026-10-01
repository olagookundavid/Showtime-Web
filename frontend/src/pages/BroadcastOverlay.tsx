import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useBroadcastViewer } from '../hooks/useBroadcastViewer';
import { calculateClockNow, formatClock, type GraphicEvent } from '../types/broadcast';
import './BroadcastOverlay.css';

export function BroadcastOverlay() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = matchId || '';

  const { state } = useBroadcastViewer(id);
  const [scale, setScale] = useState({ k: 1, x: 0, y: 0 });

  // Clock countdown timer state for smooth 1s updates
  const [clockDisplay, setClockDisplay] = useState('12:00');

  // Graphic display state & animation timers
  const [activeGraphic, setActiveGraphic] = useState<GraphicEvent | null>(null);
  const [animClass, setAnimClass] = useState<'hidden' | 'enter' | 'out'>('hidden');
  const lastGraphicIdRef = useRef<number>(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Update running clock display
  useEffect(() => {
    if (!state) return;
    setClockDisplay(formatClock(calculateClockNow(state)));

    if (!state.clock_running) return;

    const interval = setInterval(() => {
      setClockDisplay(formatClock(calculateClockNow(state)));
    }, 250);

    return () => clearInterval(interval);
  }, [state?.clock_running, state?.clock_seconds, state?.clock_stamp]);

  // Handle Graphic Events on graphic_id change
  useEffect(() => {
    if (!state) return;

    if (state.graphic && state.graphic_id !== lastGraphicIdRef.current) {
      lastGraphicIdRef.current = state.graphic_id;
      const g = state.graphic;
      setActiveGraphic(g);

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

      setAnimClass('hidden');
      // Force repaint
      requestAnimationFrame(() => {
        setAnimClass('enter');

        const duration = g.duration || 5500;
        hideTimerRef.current = setTimeout(() => {
          setAnimClass('out');
          setTimeout(() => {
            setAnimClass('hidden');
            setActiveGraphic(null);
          }, 350);
        }, duration);
      });
    } else if (!state.graphic) {
      setAnimClass('hidden');
      setActiveGraphic(null);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [state?.graphic, state?.graphic_id]);

  if (!state) {
    return <div className="broadcast-canvas" style={{ background: 'transparent' }} />;
  }

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
