import type { GamePlay } from '../services/api';

export interface StatAccrual {
    type: 'player' | 'team';
    entityName: string;     // e.g. "#7 Jane Doe" or "Lagos Hawks"
    entityTeam?: string;     // Team name or short name
    statKey: string;        // Friendly name of stat accrued e.g. "Passing Attempts"
    value: string;          // e.g. "+1", "+12 yd"
    category: 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking' | 'team' | 'penalty';
    color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'gray';
}

const who = (p?: { name: string; jersey_number: number }) =>
    p ? (p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name) : '';

export const getPlayStatAccruals = (
    p: GamePlay,
    homeTeamName: string = 'Home Team',
    _awayTeamName: string = 'Away Team'
): StatAccrual[] => {
    const accruals: StatAccrual[] = [];
    const pt = p.play_type || '';
    const res = p.result || '';
    const yards = p.yards ?? 0;

    const passingPlayTypes = ['CP', 'SCR', 'HM', 'INC', 'TA', 'TDP', 'INT', 'SACK'];
    const rushingPlayTypes = ['RUN', 'QBR', 'SWP', 'REV'];

    const offTeam = p.offense_team_id
        ? (p.offense_team_id === p.penalty_team_id ? p.penalty_team_id : homeTeamName)
        : 'Offense Team';

    // Helper to add player accrual
    const addPlayer = (
        player: { name: string; jersey_number: number } | undefined,
        statKey: string,
        val: string,
        category: StatAccrual['category'],
        color: StatAccrual['color']
    ) => {
        if (!player) return;
        accruals.push({
            type: 'player',
            entityName: who(player),
            statKey,
            value: val,
            category,
            color,
        });
    };

    // Helper to add team accrual
    const addTeam = (
        teamNameStr: string,
        statKey: string,
        val: string,
        category: StatAccrual['category'] = 'team',
        color: StatAccrual['color'] = 'indigo'
    ) => {
        if (!teamNameStr) return;
        accruals.push({
            type: 'team',
            entityName: teamNameStr,
            statKey,
            value: val,
            category,
            color,
        });
    };

    // ── 1. Defensive Flag Pulls (Tackles) ──────────────────────────────────
    if (pt !== 'SACK' && (res === 'FG' || (res !== 'TD' && res !== 'INT' && res !== 'INC' && res !== 'SAF' && (p.defender || p.rusher)))) {
        if (p.defender) {
            addPlayer(p.defender, 'Flag Pull', '+1', 'defense', 'purple');
        } else if (p.rusher) {
            addPlayer(p.rusher, 'Flag Pull', '+1', 'defense', 'purple');
        }
    }

    // ── 2. Safety ──────────────────────────────────────────────────────────
    if (res === 'SAF') {
        const tackler = p.rusher || p.defender;
        if (tackler) {
            addPlayer(tackler, 'Safety', '+1', 'defense', 'rose');
        }
        if (p.off_qb) {
            addPlayer(p.off_qb, 'Safety Conceded', '+1', 'passing', 'rose');
        }
    }

    // ── 3. Passing Plays ───────────────────────────────────────────────────
    if (passingPlayTypes.includes(pt)) {
        const qb = p.off_qb;
        const target = p.target;
        const def = p.defender;
        const rush = p.rusher;

        // Receiver Target (unless uncatchable or thrown away)
        if (target && !p.uncatchable && pt !== 'TA') {
            addPlayer(target, 'Target', '+1', 'receiving', 'blue');
        }

        switch (pt) {
            case 'SACK':
                if (qb) addPlayer(qb, 'QB Sack Taken', '+1', 'passing', 'gray');
                const sacker = rush || def;
                if (sacker) addPlayer(sacker, 'Sack (Def)', '+1', 'defense', 'purple');
                break;

            case 'INT':
                if (qb) {
                    addPlayer(qb, 'Pass Attempt', '+1', 'passing', 'gray');
                    addPlayer(qb, 'Interception Thrown', '+1', 'passing', 'rose');
                }
                const interceptor = def || rush;
                if (interceptor) {
                    addPlayer(interceptor, 'Interception', '+1', 'defense', 'rose');
                    if (p.returned_for_td) {
                        addPlayer(interceptor, 'Defensive TD (Pick 6)', '+1', 'defense', 'emerald');
                    }
                }
                break;

            case 'TDP':
                if (qb) {
                    addPlayer(qb, 'Pass Attempt', '+1', 'passing', 'gray');
                    addPlayer(qb, 'Completed Pass', '+1', 'passing', 'emerald');
                    addPlayer(qb, 'Passing Yards', `+${yards} yd`, 'passing', 'blue');
                    addPlayer(qb, 'Passing TD', '+1', 'passing', 'emerald');
                }
                if (target) {
                    addPlayer(target, 'Reception', '+1', 'receiving', 'emerald');
                    addPlayer(target, 'Receiving Yards', `+${yards} yd`, 'receiving', 'blue');
                    addPlayer(target, 'Receiving TD', '+1', 'receiving', 'emerald');
                }
                break;

            case 'TA':
                if (qb) {
                    addPlayer(qb, 'Pass Attempt', '+1', 'passing', 'gray');
                    addPlayer(qb, 'Incomplete Pass', '+1', 'passing', 'amber');
                    addPlayer(qb, 'Thrown-Away Pass', '+1', 'passing', 'amber');
                }
                break;

            default: // CP, SCR, HM, INC
                if (qb) {
                    addPlayer(qb, 'Pass Attempt', '+1', 'passing', 'gray');
                }
                if (res === 'INC' || pt === 'INC') {
                    if (qb) addPlayer(qb, 'Incomplete Pass', '+1', 'passing', 'amber');
                    if (p.dropped && target) addPlayer(target, 'Drop', '+1', 'receiving', 'rose');
                    if (p.uncatchable && qb) addPlayer(qb, 'Uncatchable Pass', '+1', 'passing', 'amber');
                    if (p.batted_down) {
                        if (qb) addPlayer(qb, 'Batted-Down Pass', '+1', 'passing', 'amber');
                        const batter = rush || def;
                        if (batter) addPlayer(batter, 'Pass Deflection', '+1', 'defense', 'purple');
                    }
                } else {
                    // Completed pass
                    if (qb) {
                        addPlayer(qb, 'Completed Pass', '+1', 'passing', 'emerald');
                        addPlayer(qb, 'Passing Yards', `${yards >= 0 ? '+' : ''}${yards} yd`, 'passing', 'blue');
                    }
                    if (target) {
                        addPlayer(target, 'Reception', '+1', 'receiving', 'emerald');
                        addPlayer(target, 'Receiving Yards', `${yards >= 0 ? '+' : ''}${yards} yd`, 'receiving', 'blue');
                    }
                }
                break;
        }
    }

    // ── 4. Rushing Plays ───────────────────────────────────────────────────
    if (rushingPlayTypes.includes(pt)) {
        const carrier = p.off_qb;
        if (carrier) {
            addPlayer(carrier, 'Rush Attempt', '+1', 'rushing', 'emerald');
            addPlayer(carrier, 'Rushing Yards', `${yards >= 0 ? '+' : ''}${yards} yd`, 'rushing', 'blue');
            if (res === 'TD') {
                addPlayer(carrier, 'Rushing TD', '+1', 'rushing', 'emerald');
            }
        }
    }

    // ── 5. Extra Points ────────────────────────────────────────────────────
    if (pt === 'XP-P') {
        if (p.off_qb) {
            addPlayer(p.off_qb, 'XP Attempt (Pass)', '+1', 'kicking', 'gray');
            if (res === 'XP') addPlayer(p.off_qb, 'XP Good', '+1', 'kicking', 'emerald');
            else if (res === 'XPF') addPlayer(p.off_qb, 'XP Failed', '+1', 'kicking', 'rose');
        }
        if (p.target) {
            addPlayer(p.target, 'Target (XP)', '+1', 'receiving', 'blue');
            if (res === 'XP') addPlayer(p.target, 'XP TD Scored', '+1', 'receiving', 'emerald');
        }
    } else if (pt === 'PAT-R') {
        if (p.off_qb) {
            addPlayer(p.off_qb, 'XP Attempt (Run)', '+1', 'kicking', 'gray');
            if (res === 'XP') {
                addPlayer(p.off_qb, 'XP Good', '+1', 'kicking', 'emerald');
                addPlayer(p.off_qb, 'XP TD Scored', '+1', 'rushing', 'emerald');
            } else if (res === 'XPF') {
                addPlayer(p.off_qb, 'XP Failed', '+1', 'kicking', 'rose');
            }
        }
    }

    // ── 6. Penalty Accruals ────────────────────────────────────────────────
    if (p.penalty) {
        const penTeamName = p.penalty_team_id ? (p.penalty_team_id === p.offense_team_id ? offTeam : 'Defending Team') : 'Team';
        addTeam(penTeamName, 'Penalty', '+1', 'penalty', 'amber');
        if (p.penalty_yards) {
            addTeam(penTeamName, 'Penalty Yards', `${p.penalty_yards} yd`, 'penalty', 'amber');
        }
        if (p.penalty_player) {
            addPlayer(p.penalty_player, `Penalty (${p.penalty})`, `${p.penalty_yards ? `${p.penalty_yards} yd` : 'Flag'}`, 'penalty', 'amber');
        }
    }

    // ── 7. Team-Level Play Stats ──────────────────────────────────────────
    if (passingPlayTypes.includes(pt) || rushingPlayTypes.includes(pt)) {
        addTeam(offTeam, 'Total Play', '+1', 'team', 'indigo');
    }
    if (res === '1D' || res === '1DG') {
        addTeam(offTeam, 'First Down', '+1', 'team', 'emerald');
    }
    if (res === 'INT' || res === 'TO') {
        addTeam(offTeam, 'Turnover Committed', '+1', 'team', 'rose');
    }
    if (pt === 'PUNT') {
        addTeam(offTeam, 'Punt', '+1', 'team', 'gray');
    }

    return accruals;
};
