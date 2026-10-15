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

function Portrait({ player, className }: { player: ScenePlayer; className: string }) {
  return player.image ? (
    <img className={className} src={player.image} alt="" />
  ) : (
    <span className="scn-player-initials">{initials(player.name)}</span>
  );
}

function Bench({ title, players, away }: { title: string; players: ScenePlayer[]; away?: boolean }) {
  return (
    <aside className={`scn-bench ${away ? 'away' : ''}`}>
      <div className="scn-bench-header">
        <strong>{title}</strong>
        <span>{players.length} PLAYERS</span>
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

function Spotlight({ node, team, index, total }: { node: LineupNode; team: string; index: number; total: number }) {
  const stats = spotlightStats(node);
  return (
    <div className={`scn-spotlight ${node.side}`}>
      <div className="scn-spotlight-portrait">
        <Portrait player={node.player} className="scn-player-photo" />
      </div>
      <div className="scn-spotlight-copy">
        <small>NOW INTRODUCING · {team}</small>
        <div className="scn-spotlight-name scn-display">{node.player.name}</div>
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
        {index + 1} OF {total}
      </div>
    </div>
  );
}

/**
 * Starting lineup: the attacking team's offence against the other team's
 * defence, with both benches. During introductions the field starts empty and
 * each starter is presented in turn before moving to their spot.
 */
export function SceneLineup({
  data,
  attackSide,
  intro,
}: {
  data: SceneData;
  attackSide: 'home' | 'away';
  intro: LineupIntro | null | undefined;
}) {
  const lineup = buildSceneLineup(data, attackSide);
  const { attack, defend, nodes } = lineup;
  const running = !!intro && intro.cursor < nodes.length;
  const cursor = intro ? Math.max(0, intro.cursor) : nodes.length;
  const current = running ? nodes.at(cursor) : undefined;

  const stage = (i: number) => (!running ? '' : i < cursor ? 'placed' : i === cursor ? 'introducing' : 'pending');
  const footer = [data.match.venue, data.match.match_number ? `Match ${data.match.match_number}` : '']
    .filter(Boolean)
    .concat(lineup.confirmed ? 'Starters confirmed' : 'Projected from the squad')
    .join(' · ');

  return (
    <section className="scn scn-lineup">
      <header className="scn-lineup-top">
        <div className="scn-lineup-heading">
          <Crest team={attack} away={attackSide === 'away'} />
          <div>
            <div className="scn-kicker">OFFENSE · STARTING {lineup.perUnit}</div>
            <strong>{attack.name}</strong>
          </div>
        </div>
        <div className="scn-lineup-title">
          <div className="scn-kicker">{matchLine(data.match)}</div>
          <strong className="scn-display">Starting Lineup</strong>
        </div>
        <div className="scn-lineup-heading right">
          <div>
            <div className="scn-kicker">DEFENSE · STARTING {lineup.perUnit}</div>
            <strong>{defend.name}</strong>
          </div>
          <Crest team={defend} away={attackSide === 'home'} />
        </div>
      </header>

      <div className="scn-lineup-content">
        <Bench title={`${attack.short || attack.name} BENCH`} players={lineup.attackBench} away={attackSide === 'away'} />

        <div className={`scn-field-wrap ${running ? 'intro' : ''}`}>
          <div className="scn-field" />
          <div className="scn-endzone left">
            <span>{attack.name}</span>
          </div>
          <div className="scn-endzone right">
            <span>{defend.name}</span>
          </div>
          <div className="scn-los-tag">LINE OF SCRIMMAGE</div>
          <div className="scn-direction left scn-display">Attack →</div>
          <div className="scn-direction right scn-display">← Defend</div>

          {nodes.map((n, i) => (
            <div
              key={n.key}
              className={`scn-player ${n.side} ${stage(i)}`}
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

          {current && (
            <Spotlight
              key={current.key}
              node={current}
              team={(current.side === 'left' ? attack : defend).short || ''}
              index={cursor}
              total={nodes.length}
            />
          )}
        </div>

        <Bench title={`${defend.short || defend.name} BENCH`} players={lineup.defendBench} away={attackSide === 'home'} />
      </div>

      <div className="scn-lineup-footer">
        <i className="scn-dot" />
        <span>{footer}</span>
      </div>
    </section>
  );
}
