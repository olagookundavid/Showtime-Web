import type { SceneData } from '../../types';
import { formatMatchTime } from '../../utils';
import { BrandBug, Crest } from './SceneParts';
import { matchLine, recordText, statusTag } from './sceneText';

/**
 * Opening matchup: the two clubs, their records and where they meet. The
 * kickoff time shows only when the producer turns it on, since matches rarely
 * start at the scheduled time.
 */
export function SceneOpening({ data, showKickoff }: { data: SceneData; showKickoff: boolean }) {
  const { match, home, away } = data;
  return (
    <section className="scn scn-opening">
      <BrandBug status={match.status} />
      <div className="scn-card">
        <div className="scn-opening-ribbon scn-kicker">
          <i className="scn-dot" />
          <span>{matchLine(match)}</span>
        </div>
        <div className="scn-opening-main">
          <div className="scn-opening-team">
            <Crest team={home} />
            <div className="scn-opening-name">{home.name}</div>
            <div className="scn-opening-record">{recordText(home)}</div>
          </div>
          <div className="scn-opening-vs">
            <strong className="scn-display">VS</strong>
            <span>{statusTag(match.status)}</span>
          </div>
          <div className="scn-opening-team">
            <Crest team={away} away />
            <div className="scn-opening-name">{away.name}</div>
            <div className="scn-opening-record">{recordText(away)}</div>
          </div>
        </div>
        <div className="scn-opening-footer">
          <div className="scn-opening-detail">
            <small>Venue</small>
            <strong>{match.venue || 'To be confirmed'}</strong>
          </div>
          {showKickoff && (
            <div className="scn-opening-detail">
              <small>Kickoff</small>
              <strong>{match.kickoff ? formatMatchTime(match.kickoff) : 'TBD'}</strong>
            </div>
          )}
          <div className="scn-opening-detail">
            <small>Competition</small>
            <strong>{match.stage}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
