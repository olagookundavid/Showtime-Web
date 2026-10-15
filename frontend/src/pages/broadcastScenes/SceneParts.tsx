import type { SceneTeam } from '../../types';
import { statusTag } from './sceneText';

/** A club's crest: its logo on a tile (home navy, away red), else its short name. */
export function Crest({ team, away }: { team: Pick<SceneTeam, 'name' | 'short' | 'logo'>; away?: boolean }) {
  return (
    <div className={`scn-crest ${away ? 'away' : ''}`}>
      {team.logo ? <img src={team.logo} alt="" /> : <span>{(team.short || team.name).slice(0, 3).toUpperCase()}</span>}
    </div>
  );
}

/** Brand bug for the top right of a scene; the scorebug steps aside while one is up. */
export function BrandBug({ status }: { status: string }) {
  const live = status === 'LIVE';
  return (
    <div className="scn-brand">
      <img src="/showtime-broadcast-logo.webp" alt="" />
      <div>
        <small>SHOWTIME FLAG</small>
        <strong>
          <i className={`scn-dot ${live ? 'live' : ''}`} />
          {live ? 'LIVE' : statusTag(status)}
        </strong>
      </div>
    </div>
  );
}
