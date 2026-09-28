import type { GamePlay } from '../services/api';

// Shared play-outcome classifiers. Kept in one place because they're read from
// three surfaces (the public timeline, the admin play editor, and the fantasy
// stat-accrual preview) that all need to agree on what counts as e.g. a return
// TD — three independent copies of the same boolean expression is exactly how
// that agreement quietly drifts.

export const isScore = (p: GamePlay) =>
    p.result === 'TD' || p.result === 'XP' || p.result === 'SAF' || (p.result === 'XPF' && p.returned_for_td);

// An interception returned for a TD is a defensive score — green, not red.
export const isPickSix = (p: GamePlay) =>
    (p.result === 'INT' || p.play_type === 'INT') && p.returned_for_td === true;

export const isReturnTD = (p: GamePlay) =>
    (p.play_type === 'KO' || p.play_type === 'PUNT') && (p.result === 'TD' || p.returned_for_td === true);

// Red "possession changed the hard way": turnover on downs, a non-returned
// interception, or a bad snap (play dies on the spot, center charged).
export const isTurnover = (p: GamePlay) =>
    p.result === 'TO' ||
    ((p.result === 'INT' || p.play_type === 'INT') && !p.returned_for_td) ||
    (p.play_type === 'BADSNAP' && p.result === 'TO');

export const isOneMinWarning = (p: GamePlay) => p.result === 'OMW' || p.result === '1MW';
export const isInjury = (p: GamePlay) => p.result === 'IH';
