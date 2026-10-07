import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../../constants';
import { useBroadcastProducer } from '../../hooks/useBroadcastProducer';
import { formatClock, calculateClockNow, type GraphicEvent } from '../../types/broadcast';
import { Loader } from '../../components/ui/Loader';
import { Button, Checkbox, Field, Input, Select } from '../../components/ui';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import {
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

const CALL_BUTTONS = [
  { label: 'Touchdown', call: 'TOUCHDOWN', red: true },
  { label: 'First down', call: 'FIRST DOWN' },
  { label: 'Second down', call: 'SECOND DOWN' },
  { label: 'Third down', call: 'THIRD DOWN' },
  { label: 'Fourth down', call: 'FOURTH DOWN' },
  { label: '1st & Goal', call: '1ST & GOAL' },
  { label: '2nd & Goal', call: '2ND & GOAL' },
  { label: '3rd & Goal', call: '3RD & GOAL' },
  { label: '4th & Goal', call: '4TH & GOAL' },
  { label: '1 min warning', call: '1 MINUTE WARNING' },
  { label: 'Safety', call: 'SAFETY' },
  { label: 'Penalty', call: 'PENALTY' },
  { label: 'Interception', call: 'INTERCEPTION' },
  { label: 'Pick six', call: 'PICK SIX' },
  { label: 'XP good', call: 'EXTRA POINT GOOD' },
  { label: 'XP bad', call: 'EXTRA POINT NO GOOD' },
  { label: 'Sack', call: 'SACK' },
  { label: 'Bat down', call: 'BAT DOWN' },
  { label: 'Flag pull', call: 'FLAG PULL' },
];

const PENALTIES = [
  'Offside',
  'Illegal participation',
  'Unnecessary roughness',
  'Pass interference',
  'Holding',
  'Delay of game',
  'Unsportsmanlike conduct',
  'Illegal forward pass',
  'Other penalty',
];

interface PlayLogItem {
  id: string;
  seq: number;
  quarter: number;
  clock?: string;
  play_type?: string;
  result?: string;
  notes?: string;
  home_score_after?: number;
  away_score_after?: number;
  target?: { name: string; jersey_number?: number };
  off_qb?: { name: string };
  defender?: { name: string };
  offense_team?: { name: string };
}

export function AdminBroadcastStudio() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = matchId || '';

  const {
    state,
    players,
    isConnected,
    error,
    updateField,
    updateScore,
    toggleClock,
    setClock,
    fireGraphic,
    hideGraphic,
  } = useBroadcastProducer(id);

  // Local controller form states
  // clockDraft holds what the producer is typing; null means show the live clock.
  const [clockDraft, setClockDraft] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [statInput, setStatInput] = useState('TOUCHDOWN RECEPTION');
  const [selectedPenalty, setSelectedPenalty] = useState(PENALTIES[0]);
  const [recentPlays, setRecentPlays] = useState<PlayLogItem[]>([]);
  // Score after the latest scored play; null until a play carries a score.
  const [pbpScore, setPbpScore] = useState<{ home: number; away: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Tick the clock display while running
  const clockRunning = state?.clock_running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [clockRunning]);

  // Fetch recent play-by-play events
  useEffect(() => {
    if (!id) return;
    async function loadPlays() {
      try {
        const res = await axios.get(`${API_URL}/matches/${id}/plays`);
        const plays: PlayLogItem[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setRecentPlays(plays.slice(-5).reverse());
        const scored = [...plays].reverse().find((p) => p.home_score_after != null && p.away_score_after != null);
        setPbpScore(scored ? { home: scored.home_score_after!, away: scored.away_score_after! } : null);
      } catch {
        // Silently continue if no plays entered yet
      }
    }
    loadPlays();
    const timer = setInterval(loadPlays, 5000);
    return () => clearInterval(timer);
  }, [id]);

  if (!state) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-4">
        <Loader />
        <span className="text-sm font-bold text-gray-500">Loading broadcast studio for match...</span>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  const overlayUrl = `${window.location.origin}/broadcast/${id}/overlay`;
  const clockInput = clockDraft ?? formatClock(calculateClockNow(state, now));
  const team = selectedTeam || state.home || 'Home Team';

  const handleToggleClock = () => {
    setClockDraft(null);
    toggleClock();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSetClock = () => {
    const parts = clockInput.trim().split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs) && secs >= 0 && secs < 60) {
        setClock(mins * 60 + secs);
        setClockDraft(null);
        return;
      }
    }
    toast.error('Please enter time as MM:SS (e.g. 12:00 or 06:25)');
  };

  const handleTriggerCall = (callType: string) => {
    const playerObj = players.find((p) => p.player_id === selectedPlayerId);
    const noPlayer = /1 MINUTE WARNING|PENALTY|EXTRA POINT|SAFETY|GOAL|FIRST DOWN|SECOND DOWN|THIRD DOWN|FOURTH DOWN/.test(
      callType
    );

    let statText = statInput;
    if (callType === 'PENALTY') {
      statText = selectedPenalty;
    } else if (callType === '1 MINUTE WARNING') {
      statText = `${state.period} · ONE MINUTE REMAINING`;
    }

    const graphic: GraphicEvent = {
      type: callType,
      number: noPlayer ? '' : playerObj ? String(playerObj.jersey_number) : '',
      player: noPlayer ? '' : playerObj ? playerObj.name : '',
      team,
      stat: statText,
      photo: playerObj?.image || '',
      compact: /DOWN|GOAL|EXTRA POINT|FLAG PULL|PENALTY|BAT DOWN/.test(callType),
      duration: 5500,
    };

    fireGraphic(graphic);
  };

  // Prepare a play from the queue into the form (manual workflow)
  const handlePreparePlay = (p: PlayLogItem) => {
    const name = p.target?.name || p.off_qb?.name || p.defender?.name || '';
    if (name) {
      const matchPlayer = players.find((pl) => pl.name.toLowerCase() === name.toLowerCase());
      if (matchPlayer) {
        setSelectedPlayerId(matchPlayer.player_id);
      }
    }
    if (p.offense_team?.name) {
      setSelectedTeam(p.offense_team.name);
    }
    const playDesc = p.notes || `${p.play_type || 'PLAY'} ${p.result || ''}`.trim();
    if (playDesc) {
      setStatInput(playDesc);
    }
  };

  // Live score from the play log; falls back to the snapshot taken when the studio state was created.
  const pbpHome = pbpScore?.home ?? state.pbp_home;
  const pbpAway = pbpScore?.away ?? state.pbp_away;
  const isScoreAligned = state.manual_home === pbpHome && state.manual_away === pbpAway;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        back={{ to: '/admin/broadcast', label: 'Back to matches' }}
        title={
          <span className="flex items-center gap-2">
            <span>{state.home} vs {state.away}</span>
          </span>
        }
        subtitle="On-air graphics control for vMix."
        actions={
          <>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${
                isConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'Live sync active' : 'Connecting...'}
            </span>
            <Button
              variant="secondary"
              icon={copied ? ClipboardDocumentCheckIcon : ClipboardDocumentIcon}
              onClick={copyUrl}
              title="Copy public vMix transparent overlay URL"
            >
              {copied ? 'Copied URL!' : 'vMix Overlay URL'}
            </Button>
          </>
        }
      />

      {/* Main Grid: Control Station on Left, Preview and Status on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Scoreboard Controls */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <h2 className="font-black text-gray-900 dark:text-white text-base md:text-lg tracking-tight">
                On-air scoreboard
              </h2>
              <Checkbox
                label="Show scorebug on air"
                checked={state.scorebug}
                onChange={(e) => updateField('scorebug', e.target.checked)}
              />
            </div>

            {/* Score Inputs Home vs Away */}
            <div className="grid grid-cols-5 items-center gap-3">
              {/* Home Score */}
              <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col items-center">
                <span className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 truncate w-full text-center">
                  {state.home}
                </span>
                <input
                  type="number"
                  min="0"
                  aria-label={`${state.home} score`}
                  value={state.manual_home}
                  onChange={(e) => updateScore(parseInt(e.target.value, 10) || 0, state.manual_away)}
                  className="w-20 text-center text-4xl font-black bg-transparent text-gray-900 dark:text-white border-0 focus:ring-0"
                />
                {/* Home Timeouts */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">TO:</span>
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        updateField('timeouts_home', state.timeouts_home > idx ? idx : idx + 1)
                      }
                      className={`w-3.5 h-3.5 rounded-full border transition-colors cursor-pointer ${
                        idx < state.timeouts_home
                          ? 'bg-sffl-red border-sffl-red'
                          : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                      }`}
                      title={`Toggle timeout ${idx + 1}`}
                      aria-label={`Toggle ${state.home} timeout ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* VS Divider */}
              <div className="col-span-1 text-center font-black text-gray-400 text-lg">VS</div>

              {/* Away Score */}
              <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600 flex flex-col items-center">
                <span className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 truncate w-full text-center">
                  {state.away}
                </span>
                <input
                  type="number"
                  min="0"
                  aria-label={`${state.away} score`}
                  value={state.manual_away}
                  onChange={(e) => updateScore(state.manual_home, parseInt(e.target.value, 10) || 0)}
                  className="w-20 text-center text-4xl font-black bg-transparent text-gray-900 dark:text-white border-0 focus:ring-0"
                />
                {/* Away Timeouts */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">TO:</span>
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        updateField('timeouts_away', state.timeouts_away > idx ? idx : idx + 1)
                      }
                      className={`w-3.5 h-3.5 rounded-full border transition-colors cursor-pointer ${
                        idx < state.timeouts_away
                          ? 'bg-sffl-red border-sffl-red'
                          : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                      }`}
                      title={`Toggle timeout ${idx + 1}`}
                      aria-label={`Toggle ${state.away} timeout ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Score Alignment Notice (Staff Only) */}
            <div
              className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                isScoreAligned
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {isScoreAligned ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                )}
                <span>
                  <b>{isScoreAligned ? 'Scores aligned' : 'Score discrepancy'}:</b> Manual ({state.manual_home}–{state.manual_away}) vs PBP ({pbpHome}–{pbpAway})
                </span>
              </div>
              {!isScoreAligned && (
                <Button variant="link" size="sm" onClick={() => updateScore(pbpHome, pbpAway)}>
                  Sync to PBP
                </Button>
              )}
            </div>

            {/* Clock, Period, Down & Possession Rows */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Period */}
              <Field label="Period" htmlFor="broadcast-period">
                <Select
                  id="broadcast-period"
                  value={state.period}
                  onChange={(e) => updateField('period', e.target.value)}
                >
                  <option value="H1">1st Half (H1)</option>
                  <option value="HALF">Halftime (HALF)</option>
                  <option value="H2">2nd Half (H2)</option>
                  <option value="OT">Overtime (OT)</option>
                  <option value="FINAL">Final</option>
                </Select>
              </Field>

              {/* Countdown Clock */}
              <Field label="Countdown clock (MM:SS)" htmlFor="broadcast-clock">
                <div className="flex items-center gap-1.5">
                  <Input
                    id="broadcast-clock"
                    type="text"
                    value={clockInput}
                    onChange={(e) => setClockDraft(e.target.value)}
                    className="flex-1 min-w-0"
                    placeholder="12:00"
                  />
                  <Button variant="secondary" onClick={handleSetClock}>
                    Set
                  </Button>
                </div>
              </Field>

              {/* Clock Action Toggle */}
              <div className="flex flex-col justify-end">
                <Button
                  variant={state.clock_running ? 'warning' : 'success'}
                  icon={state.clock_running ? PauseIcon : PlayIcon}
                  onClick={handleToggleClock}
                  fullWidth
                >
                  {state.clock_running ? 'Pause clock' : 'Start clock'}
                </Button>
              </div>
            </div>

            {/* Down & Possession */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Field label="Down & distance" htmlFor="broadcast-down">
                <Select
                  id="broadcast-down"
                  value={state.down}
                  onChange={(e) => updateField('down', e.target.value)}
                >
                  <option value="1">1st Down</option>
                  <option value="2">2nd Down</option>
                  <option value="3">3rd Down</option>
                  <option value="4">4th Down</option>
                  <option value="1G">1st & Goal</option>
                  <option value="2G">2nd & Goal</option>
                  <option value="3G">3rd & Goal</option>
                  <option value="4G">4th & Goal</option>
                </Select>
              </Field>

              <Field label="Ball possession" htmlFor="broadcast-possession">
                <Select
                  id="broadcast-possession"
                  value={state.possession}
                  onChange={(e) => updateField('possession', e.target.value)}
                >
                  <option value={state.home}>{state.home} (Home)</option>
                  <option value={state.away}>{state.away} (Away)</option>
                </Select>
              </Field>
            </div>
          </div>

          {/* Section 2: Player & Lower-Third Trigger Panel */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base md:text-lg tracking-tight">
                  Lower-third graphic
                </h2>
                <p className="text-xs text-gray-500">Configure player or event banner and fire on air</p>
              </div>
              <Button variant="secondary" icon={EyeSlashIcon} onClick={hideGraphic}>
                Hide graphic now
              </Button>
            </div>

            {/* Player Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Select player" htmlFor="broadcast-player">
                <Select
                  id="broadcast-player"
                  value={selectedPlayerId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedPlayerId(pid);
                    const p = players.find((pl) => pl.player_id === pid);
                    if (p) {
                      setSelectedTeam(p.team_name);
                    }
                  }}
                >
                  <option value="">-- No specific player --</option>
                  {players.map((p) => (
                    <option key={p.player_id} value={p.player_id}>
                      #{p.jersey_number} {p.name} · {p.position} ({p.team_name})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Team" htmlFor="broadcast-team">
                <Select
                  id="broadcast-team"
                  value={team}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                >
                  <option value={state.home}>{state.home}</option>
                  <option value={state.away}>{state.away}</option>
                </Select>
              </Field>
            </div>

            {/* Custom Stat Line & Penalty selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Stat line / subtitle" htmlFor="broadcast-stat">
                <Input
                  id="broadcast-stat"
                  type="text"
                  value={statInput}
                  onChange={(e) => setStatInput(e.target.value)}
                  placeholder="e.g. 42 YD TOUCHDOWN · 2 TD TODAY"
                />
              </Field>

              <Field label="Penalty call type" htmlFor="broadcast-penalty">
                <Select
                  id="broadcast-penalty"
                  value={selectedPenalty}
                  onChange={(e) => setSelectedPenalty(e.target.value)}
                >
                  {PENALTIES.map((pen) => (
                    <option key={pen} value={pen}>
                      {pen}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Event Button Grid */}
            <div>
              <span className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Fast-trigger event callouts
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {CALL_BUTTONS.map((btn) => (
                  <Button
                    key={btn.call}
                    variant={btn.red ? 'danger' : 'navy'}
                    onClick={() => handleTriggerCall(btn.call)}
                    fullWidth
                    className={`uppercase tracking-wider ${btn.red ? 'col-span-2 sm:col-span-3 md:col-span-4 py-3 text-sm' : ''}`}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Recent Play-by-Play Event Queue (Manual Mode) */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base md:text-lg tracking-tight">
                  Play-by-play queue
                </h2>
                <p className="text-xs text-gray-500">Click PREPARE to review and manually trigger lower-third graphic</p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                Manual trigger mode
              </span>
            </div>

            {recentPlays.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No recent plays logged yet. New plays will appear here automatically.
              </p>
            ) : (
              <div className="space-y-2">
                {recentPlays.map((p) => {
                  const playerName = p.target?.name || p.off_qb?.name || p.defender?.name || 'Play Event';
                  const teamName = p.offense_team?.name || 'Offense';
                  const summary = p.notes || `${p.play_type || ''} ${p.result || ''}`.trim();

                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-black text-gray-900 dark:text-white truncate block">
                          Q{p.quarter} · {playerName} ({teamName})
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 block truncate">
                          {summary}
                        </span>
                      </div>
                      <Button variant="navy" size="sm" onClick={() => handlePreparePlay(p)} className="shrink-0">
                        Prepare
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 5 Cols (Preview Monitor & vMix Info) */}
        <div className="lg:col-span-5 space-y-6">
          {/* vMix Live Output Preview Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-900 dark:text-white text-base tracking-tight flex items-center gap-2">
                vMix output monitor
              </h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black rounded-full">
                1920 × 1080 · ALPHA
              </span>
            </div>

            {/* Simulated 16:9 monitor frame */}
            <div className="aspect-video relative rounded-xl overflow-hidden border border-gray-300 dark:border-gray-600 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 shadow-inner flex items-center justify-center">
              {/* Field Grid Backdrop */}
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[repeating-linear-gradient(90deg,transparent_0_15%,#fff_15%_16%)]" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/20 font-black tracking-widest text-xs">
                SIMULATED BROADCAST FEED
              </div>

              {/* Embedded Live Transparent Overlay */}
              <iframe
                src={`/broadcast/${id}/overlay`}
                title="Live Overlay Preview"
                className="w-full h-full border-0 relative z-10 pointer-events-none"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>Transparent overlay floats above camera feed</span>
              <a
                href={overlayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sffl-red hover:underline font-bold flex items-center gap-1"
              >
                Open in new tab <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* vMix Setup Instructions */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-wider text-sm">
              vMix Operator Setup
            </h3>

            <div className="space-y-2 text-gray-600 dark:text-gray-300">
              <p>
                <b>1.</b> In vMix on your broadcast PC, click <b>Add Input</b> (bottom-left).
              </p>
              <p>
                <b>2.</b> Select <b>Web Browser</b> from the left list.
              </p>
              <p>
                <b>3.</b> Paste this overlay URL:
              </p>
              <div className="flex items-center gap-1.5 p-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 font-mono text-[11px] select-all break-all">
                <span>{overlayUrl}</span>
              </div>
              <p>
                <b>4.</b> Set Resolution: <b>1920 × 1080</b>.
              </p>
              <p>
                <b>5.</b> Assign this Web Browser input to <b>Overlay 1</b> in vMix.
              </p>
            </div>

            <Button variant="primary" icon={copied ? ClipboardDocumentCheckIcon : ClipboardDocumentIcon} onClick={copyUrl} fullWidth>
              {copied ? 'Overlay URL copied!' : 'Copy overlay URL for vMix'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBroadcastStudio;
