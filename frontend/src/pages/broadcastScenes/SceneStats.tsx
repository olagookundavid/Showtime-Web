import type { BroadcastState, SceneData } from '../../types';
import { attackRows, defenceRows, type ComparisonRow, type TeamComparison } from '../../utils';
import { BrandBug, Crest } from './SceneParts';

export type StatsHalf = 'attack' | 'defence';

const TITLE: Record<StatsHalf, string> = {
  attack: 'Attack & Possession',
  defence: 'Defence & Discipline',
};

function StatRow({ row }: { row: ComparisonRow }) {
  const total = row.homeValue + row.awayValue;
  const homeShare = total ? Math.round((row.homeValue / total) * 100) : 50;
  return (
    <div className="scn-stat">
      <div className="scn-stat-value">{row.homeText}</div>
      <div>
        <div className="scn-stat-label">{row.label}</div>
        <div className="scn-stat-track">
          <span className="home" style={{ width: `${homeShare}%` }} />
          <span className="away" />
        </div>
      </div>
      <div className="scn-stat-value">{row.awayText}</div>
    </div>
  );
}

/**
 * One half of the match comparison (attack or defence), full screen: the
 * on-air score and clock over the same lines, with the same numbers, as the
 * public match page.
 */
export function SceneStats({
  half,
  data,
  comparison,
  state,
  clock,
}: {
  half: StatsHalf;
  data: SceneData;
  comparison: TeamComparison;
  state: BroadcastState;
  clock: string;
}) {
  const { home, away, match } = data;
  const rows = half === 'attack' ? attackRows(comparison) : defenceRows(comparison);
  const anyLogged = rows.some((r) => r.homeValue || r.awayValue);
  return (
    <section className={`scn scn-stats ${half}`}>
      <BrandBug status={match.status} />
      <div className="scn-card">
        <div className="scn-facts-titlebar">
          <div className="scn-facts-title scn-display">{TITLE[half]}</div>
          <div className="scn-facts-live">
            <i className={`scn-dot ${match.status === 'LIVE' ? 'live' : ''}`} />
            {match.status === 'LIVE' ? 'LIVE DATA' : 'MATCH COMPARISON'}
          </div>
        </div>
        <div className="scn-facts-scorebar">
          <div className="scn-facts-team">
            <Crest team={home} />
            <span>{home.name}</span>
          </div>
          <div className="scn-facts-score">
            <strong>
              {state.manual_home} – {state.manual_away}
            </strong>
            <span>
              {state.period} · {clock}
            </span>
          </div>
          <div className="scn-facts-team away">
            <span>{away.name}</span>
            <Crest team={away} away />
          </div>
        </div>
        <div className="scn-stats-body">
          {rows.map((r) => (
            <StatRow key={r.label} row={r} />
          ))}
        </div>
        <div className="scn-facts-source">
          {anyLogged ? 'FROM THE PLAY-BY-PLAY · UPDATES LIVE' : 'STATS APPEAR HERE AS PLAYS ARE LOGGED'}
        </div>
      </div>
    </section>
  );
}
