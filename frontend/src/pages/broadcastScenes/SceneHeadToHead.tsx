import type { SceneData, SceneMeeting } from '../../types';
import { formatMatchDate } from '../../utils';
import { summariseHeadToHead, type Biggest } from './headToHead';
import { BrandBug, Crest } from './SceneParts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const avg = (points: number, games: number) => (games ? (points / games).toFixed(1) : '0');
// A biggest win reads winner first, whichever side won it.
const biggestText = (b?: Biggest) =>
  b
    ? `${Math.max(b.meeting.home_score, b.meeting.away_score)}–${Math.min(b.meeting.home_score, b.meeting.away_score)}`
    : '—';

function Line({ label, home, away, homeValue, awayValue }: { label: string; home: string | number; away: string | number; homeValue: number; awayValue: number }) {
  const total = homeValue + awayValue;
  const homeShare = total ? Math.round((homeValue / total) * 100) : 50;
  return (
    <div className="scn-stat">
      <div className="scn-stat-value">{home}</div>
      <div>
        <div className="scn-stat-label">{label}</div>
        <div className="scn-stat-track">
          <span className="home" style={{ width: `${homeShare}%` }} />
          <span className="away" />
        </div>
      </div>
      <div className="scn-stat-value">{away}</div>
    </div>
  );
}

function Meeting({ m, home, away }: { m: SceneMeeting; home: string; away: string }) {
  const homeWon = m.home_score > m.away_score;
  const awayWon = m.away_score > m.home_score;
  return (
    <div className="scn-h2h-meeting">
      <span className="scn-h2h-when">
        {formatMatchDate(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}
        <small>{m.competition}</small>
      </span>
      <span className={`scn-h2h-side ${homeWon ? 'won' : ''}`}>{home}</span>
      <span className="scn-h2h-score">
        {m.home_score} – {m.away_score}
      </span>
      <span className={`scn-h2h-side away ${awayWon ? 'won' : ''}`}>{away}</span>
      <span aria-hidden="true" />
    </div>
  );
}

/**
 * Head to head: every earlier meeting of the two clubs, in any competition —
 * the overall record, points, each side's biggest win and the latest results.
 */
export function SceneHeadToHead({ data }: { data: SceneData }) {
  const { home, away, match } = data;
  const s = summariseHeadToHead(data.head_to_head);
  const homeName = home.short || home.name;
  const awayName = away.short || away.name;

  return (
    <section className="scn scn-stats scn-h2h">
      <BrandBug status={match.status} />
      <div className="scn-card">
        <div className="scn-facts-titlebar">
          <div className="scn-facts-title scn-display">Head to Head</div>
          <div className="scn-facts-live">
            {s.meetings ? `ALL COMPETITIONS · SINCE ${s.since}` : 'ALL COMPETITIONS'}
          </div>
        </div>

        <div className="scn-facts-scorebar scn-h2h-hero">
          <div className="scn-facts-team">
            <Crest team={home} />
            <span>{home.name}</span>
          </div>
          <div className="scn-facts-score">
            {s.meetings ? (
              <>
                <strong>
                  {s.homeWins} – {s.awayWins}
                </strong>
                <span>
                  {plural(s.meetings, 'MEETING', 'MEETINGS')}
                  {s.draws ? ` · ${plural(s.draws, 'DRAW', 'DRAWS')}` : ''}
                </span>
              </>
            ) : (
              <strong className="scn-h2h-first scn-display">First Meeting</strong>
            )}
          </div>
          <div className="scn-facts-team away">
            <span>{away.name}</span>
            <Crest team={away} away />
          </div>
        </div>

        {s.meetings ? (
          <>
            <div className="scn-stats-body">
              <Line label="Wins" home={s.homeWins} away={s.awayWins} homeValue={s.homeWins} awayValue={s.awayWins} />
              <Line label="Points Scored" home={s.homePoints} away={s.awayPoints} homeValue={s.homePoints} awayValue={s.awayPoints} />
              <Line
                label="Points per Game"
                home={avg(s.homePoints, s.meetings)}
                away={avg(s.awayPoints, s.meetings)}
                homeValue={s.homePoints}
                awayValue={s.awayPoints}
              />
              <Line
                label="Biggest Win"
                home={biggestText(s.homeBiggest)}
                away={biggestText(s.awayBiggest)}
                homeValue={s.homeBiggest?.margin ?? 0}
                awayValue={s.awayBiggest?.margin ?? 0}
              />
            </div>
            <div className="scn-h2h-recent">
              <div className="scn-kicker">
                {s.recent.length === s.meetings ? 'Every meeting' : `Last ${s.recent.length} meetings`}
              </div>
              {s.recent.map((m, i) => (
                <Meeting key={`${m.date}-${i}`} m={m} home={homeName} away={awayName} />
              ))}
            </div>
          </>
        ) : (
          <div className="scn-h2h-empty">These clubs have never met before. Today writes the first chapter.</div>
        )}

        <div className="scn-facts-source">FINISHED MATCHES BETWEEN THE TWO CLUBS, IN EVERY COMPETITION</div>
      </div>
    </section>
  );
}
