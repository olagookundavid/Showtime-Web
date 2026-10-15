import type { SceneData } from '../../types';
import { BrandBug, Crest } from './SceneParts';

// A long table shrinks its rows so every team fits the frame.
const rowHeight = (rows: number) => Math.max(34, Math.min(58, Math.floor(690 / Math.max(rows, 1))));

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/**
 * The competition table, live: it counts in-progress matches at their current
 * score. The two teams playing are highlighted.
 */
export function SceneStandings({ data }: { data: SceneData }) {
  const { standings, match, home, away } = data;
  const playing = new Set([home.id, away.id]);
  return (
    <section className="scn scn-standings">
      <BrandBug status={match.status} />
      <div className="scn-card" style={{ ['--scn-row-h' as string]: `${rowHeight(standings.length)}px` }}>
        <div className="scn-standings-header">
          <div>
            <div className="scn-kicker">{match.competition}</div>
            <strong className="scn-display">Live Standings</strong>
          </div>
          <span className="scn-standings-badge">
            <i className="scn-dot live" />
            INCLUDING LIVE SCORES
          </span>
        </div>
        <div className="scn-table-row head">
          <span>#</span>
          <span>Team</span>
          <span>P</span>
          <span>W</span>
          <span>L</span>
          <span>PF</span>
          <span>PA</span>
          <span>PD</span>
          <span>PCT</span>
          <span>Form</span>
        </div>
        {standings.map((row) => (
          <div key={row.team_id} className={`scn-table-row ${playing.has(row.team_id) ? 'focus' : ''}`}>
            <span className="scn-rank">{row.position}</span>
            <span className="scn-table-team">
              <Crest team={row} away={row.team_id === away.id} />
              <span>{row.name}</span>
            </span>
            <span>{row.played}</span>
            <span>{row.won}</span>
            <span>{row.lost}</span>
            <span>{row.pf}</span>
            <span>{row.pa}</span>
            <span>{signed(row.pd)}</span>
            <span className="scn-pct">{row.pct.toFixed(1)}</span>
            <span className="scn-form">
              {row.form.split('').map((r, i) => (
                <i key={i} className={r}>
                  {r}
                </i>
              ))}
            </span>
          </div>
        ))}
        <div className="scn-standings-footer">
          POSITIONS UPDATE FROM FINISHED MATCHES AND THE CURRENT SCORE OF MATCHES IN PLAY
        </div>
      </div>
    </section>
  );
}
