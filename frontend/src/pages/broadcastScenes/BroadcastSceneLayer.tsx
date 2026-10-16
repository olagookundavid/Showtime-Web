import { useBroadcastScenes, useMatchComparison } from '../../hooks';
import type { BroadcastState } from '../../types';
import { SceneHeadToHead } from './SceneHeadToHead';
import { SceneLineup } from './SceneLineup';
import { SceneOpening } from './SceneOpening';
import { SceneStandings } from './SceneStandings';
import { SceneStats } from './SceneStats';
import './BroadcastScenes.css';

/**
 * The full-screen scene the studio has on air, if any. Its data is fetched for
 * whichever match the state names, so an event-day overlay follows the match on
 * air. Nothing shows until the data has loaded.
 */
export function BroadcastSceneLayer({ state, clock }: { state: BroadcastState; clock: string }) {
  const scene = state.scene || '';
  const { data } = useBroadcastScenes(state.match_id, !!scene);
  // 'facts' is the single stats scene from before attack and defence were split.
  const statsHalf = scene === 'defence' ? 'defence' : scene === 'attack' || scene === 'facts' ? 'attack' : null;
  const comparison = useMatchComparison(state.match_id, data, !!statsHalf);
  if (!scene || !data || data.match.id !== state.match_id) return null;

  if (statsHalf) {
    return comparison ? (
      <SceneStats half={statsHalf} data={data} comparison={comparison} state={state} clock={clock} />
    ) : null;
  }

  switch (scene) {
    case 'opening':
      return <SceneOpening data={data} showKickoff={!!state.show_kickoff} />;
    case 'standings':
      return data.standings.length ? <SceneStandings data={data} /> : null;
    case 'h2h':
      return <SceneHeadToHead data={data} />;
    case 'lineup':
      return <SceneLineup data={data} side={state.lineup_team ?? 'home'} intro={state.lineup_intro} />;
    default:
      return null;
  }
}
