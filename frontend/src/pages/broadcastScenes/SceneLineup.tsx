import type { LineupIntro, SceneData, ScenePlayer } from '../../types';
import { benchPosition, buildSceneLineup, spotlightStats, type LineupNode } from './lineupScene';
import { Crest } from './SceneParts';
import { matchLine } from './sceneText';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w.replace('.', '')[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Portrait({ player, className }: { player: ScenePlayer; className: string }) {
  return player.image ? (
    <img className={className} src={player.image} alt="" />
  ) : (
    <span className="scn-player-initials">{initials(player.name)}</span>
  );
}

/** The bench: dimmed while the starters are introduced, lit up on its own step. */
function Bench({ title, players, stage }: { title: string; players: ScenePlayer[]; stage: 'waiting' | 'spot' | '' }) {
  return (
    <aside className={`scn-bench ${stage}`}>
      <div className="scn-bench-header">
        <strong>{title}</strong>
        <span>{plural(players.length, 'PLAYER', 'PLAYERS')}</span>
      </div>
      {players.length ? (
        <div className="scn-bench-list">
          {players.map((p) => (
            <div key={p.id} className="scn-bench-player">
              <span className="scn-bench-number">{p.number}</span>
              <span className="scn-bench-name">{p.name}</span>
              <span className="scn-bench-pos">{benchPosition(p.position)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="scn-bench-empty">No substitutes named.</div>
      )}
    </aside>
  );
}

// Long names step down in size so they show in full beside the stats.
const spotlightNameSize = (name: string) => (name.length > 22 ? 26 : name.length > 16 ? 31 : 38);

function Spotlight({ node, team, step, steps }: { node: LineupNode; team: string; step: number; steps: number }) {
  const stats = spotlightStats(node);
  return (
    <div className="scn-spotlight">
      <div className="scn-spotlight-portrait">
        <Portrait player={node.player} className="scn-player-photo" />
      </div>
      <div className="scn-spotlight-copy">
        <small>
          NOW INTRODUCING · {team} {node.unit === 'offense' ? 'OFFENSE' : 'DEFENSE'}
        </small>
        <div className="scn-spotlight-name scn-display" style={{ fontSize: spotlightNameSize(node.player.name) }}>
          {node.player.name}
        </div>
        <div className="scn-spotlight-meta">
          #{node.player.number} · {node.roleLong.toUpperCase()}
        </div>
      </div>
      {stats ? (
        <div className="scn-spotlight-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="scn-spotlight-debut">SEASON DEBUT</div>
      )}
      <div className="scn-spotlight-count">
        {step + 1} OF {steps}
      </div>
    </div>
  );
}

/** The last introduction step: the bench as a whole. */
function BenchSpotlight({ team, count, steps }: { team: string; count: number; steps: number }) {
  return (
    <div className="scn-spotlight bench">
      <div className="scn-spotlight-copy">
        <small>NOW INTRODUCING · {team}</small>
        <div className="scn-spotlight-name scn-display">The Bench</div>
        <div className="scn-spotlight-meta">{plural(count, 'SUBSTITUTE', 'SUBSTITUTES')} READY TO COME ON</div>
      </div>
      <div className="scn-spotlight-count">
        {steps} OF {steps}
      </div>
    </div>
  );
}

/**
 * Starting lineup, one team at a time: its offence and defence on the field
 * and its bench beside it. During introductions the field starts empty, each
 * starter is presented centre stage before moving to their spot, and the
 * bench is introduced last, as a whole.
 */
export function SceneLineup({
  data,
  side,
  intro,
}: {
  data: SceneData;
  side: 'home' | 'away';
  intro: LineupIntro | null | undefined;
}) {
  const lineup = buildSceneLineup(data, side);
  const { team, nodes, bench, steps } = lineup;
  const running = !!intro && intro.cursor < steps;
  const cursor = intro ? Math.max(0, intro.cursor) : steps;
  const current = running ? nodes.at(cursor) : undefined;
  const benchStep = running && cursor === nodes.length;
  const teamName = (team.short || team.name).toUpperCase();

  const stage = (i: number) => (!running ? '' : i < cursor ? 'placed' : i === cursor ? 'introducing' : 'pending');
  const footer = [data.match.venue, data.match.match_number ? `Match ${data.match.match_number}` : '']
    .filter(Boolean)
    .concat(lineup.confirmed ? 'Starters confirmed' : 'Projected from the squad')
    .join(' · ');

  return (
    <section className={`scn scn-lineup ${side}`}>
      <header className="scn-lineup-top">
        <div className="scn-lineup-heading">
          <Crest team={team} away={side === 'away'} />
          <div>
            <div className="scn-kicker">
              STARTING {lineup.perUnit} · OFFENSE & DEFENSE
            </div>
            <strong>{team.name}</strong>
          </div>
        </div>
        <div className="scn-lineup-title">
          <div className="scn-kicker">{matchLine(data.match)}</div>
          <strong className="scn-display">Starting Lineup</strong>
        </div>
      </header>

      <div className="scn-lineup-content">
        <div className={`scn-field-wrap ${running ? 'intro' : ''} ${benchStep ? 'bench-step' : ''}`}>
          <div className="scn-field" />
          <div className="scn-endzone left">
            <span>Offense</span>
          </div>
          <div className="scn-endzone right">
            <span>Defense</span>
          </div>

          {nodes.map((n, i) => (
            <div
              key={n.key}
              className={`scn-player ${n.unit} ${stage(i)}`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <div className="scn-player-marker">
                <Portrait player={n.player} className="scn-player-photo" />
                <span className="scn-player-number">{n.player.number}</span>
              </div>
              <div className="scn-player-card">
                <div className="scn-player-name">{n.player.name}</div>
                <div className="scn-player-role">{n.role}</div>
              </div>
            </div>
          ))}

          <div className="scn-formation left">{lineup.offenseLabel}</div>
          <div className="scn-formation right">{lineup.defenseLabel}</div>

          {current && <Spotlight key={current.key} node={current} team={teamName} step={cursor} steps={steps} />}
          {benchStep && <BenchSpotlight team={teamName} count={bench.length} steps={steps} />}
        </div>

        <Bench
          title={`${teamName} BENCH`}
          players={bench}
          stage={benchStep ? 'spot' : running ? 'waiting' : ''}
        />
      </div>

      <div className="scn-lineup-footer">
        <i className="scn-dot" />
        <span>{footer}</span>
      </div>
    </section>
  );
}
