import type { BroadcastState, SceneData, SceneFact } from '../../types';
import { BrandBug, Crest } from './SceneParts';

const show = (value: number, unit?: string) => `${value}${unit ?? ''}`;

function FactRow({ fact }: { fact: SceneFact }) {
  const total = fact.home + fact.away;
  const homeShare = total ? Math.round((fact.home / total) * 100) : 50;
  return (
    <div className="scn-fact">
      <div className="scn-fact-value">{show(fact.home, fact.unit)}</div>
      <div>
        <div className="scn-fact-label">{fact.label}</div>
        <div className="scn-fact-track">
          <span className="home" style={{ width: `${homeShare}%` }} />
          <span className="away" />
        </div>
      </div>
      <div className="scn-fact-value">{show(fact.away, fact.unit)}</div>
    </div>
  );
}

/**
 * Match facts: the on-air score and clock (from the studio) over team totals
 * from the play-by-play, which refresh while the scene is up.
 */
export function SceneFacts({ data, state, clock }: { data: SceneData; state: BroadcastState; clock: string }) {
  const { home, away, facts, match } = data;
  const anyLogged = facts.some((f) => f.home || f.away);
  return (
    <section className="scn scn-facts">
      <BrandBug status={match.status} />
      <div className="scn-card">
        <div className="scn-facts-titlebar">
          <div className="scn-facts-title scn-display">Match Facts</div>
          <div className="scn-facts-live">
            <i className={`scn-dot ${match.status === 'LIVE' ? 'live' : ''}`} />
            {match.status === 'LIVE' ? 'LIVE DATA' : 'FROM THE PLAY-BY-PLAY'}
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
        <div className="scn-facts-body">
          {facts.map((f) => (
            <FactRow key={f.label} fact={f} />
          ))}
        </div>
        <div className="scn-facts-source">
          {anyLogged
            ? 'LIVE FROM THE MATCH SCORE, CLOCK AND PLAY-BY-PLAY'
            : 'STATS APPEAR HERE AS PLAYS ARE LOGGED'}
        </div>
      </div>
    </section>
  );
}
