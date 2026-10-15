import { useBroadcastScenes } from '../../hooks';
import type { BroadcastState } from '../../types';
import { SceneFacts } from './SceneFacts';
import { SceneLineup } from './SceneLineup';
import { SceneOpening } from './SceneOpening';
import { SceneStandings } from './SceneStandings';
import './BroadcastScenes.css';

/**
 * The full-screen scene the studio has on air, if any. Its data is fetched for
 * whichever match the state names, so an event-day overlay follows the match on
 * air. Nothing shows until the data has loaded.
 */
export function BroadcastSceneLayer({ state, clock }: { state: BroadcastState; clock: string }) {
  const scene = state.scene || '';
  const { data } = useBroadcastScenes(state.match_id, !!scene);
  if (!scene || !data || data.match.id !== state.match_id) return null;

  switch (scene) {
    case 'opening':
      return <SceneOpening data={data} />;
    case 'facts':
      return <SceneFacts data={data} state={state} clock={clock} />;
    case 'standings':
      return data.standings.length ? <SceneStandings data={data} /> : null;
    case 'lineup':
      return <SceneLineup data={data} attackSide={state.lineup_attack ?? 'home'} intro={state.lineup_intro} />;
    default:
      return null;
  }
}
