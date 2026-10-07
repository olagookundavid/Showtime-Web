export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8089/api/v1';

export const COMMENTS_PAGE_SIZE = 30;

// Official code strings from the stat sheet (FG = Flag Pull, KO = Throw-Off).
export const PLAY_TYPE_CODES = ['CP', 'INC', 'TDP', 'INT', 'SACK', 'SCR', 'HM', 'TA', 'XP-P', 'RUN', 'QBR', 'SWP', 'REV', 'PAT-R', 'PUNT', 'KO', 'SAF'] as const;
// INC and SAF aren't on the official sheet's Result Codes list but are accepted
// by the backend as practical extensions — see domain.ResultCodes comment.
export const RESULT_CODES = ['1D', '1DG', 'TD', 'XP', 'XPF', 'TO', 'INT', 'OB', 'FG', 'DB', 'IH', 'EH', 'EG', 'INC', 'SAF'] as const;
export const PENALTY_CODES = ['FS', 'OFF', 'ENC', 'DOG', 'OPI', 'DPI', 'FGD', 'HLD', 'RPC', 'IMP', 'SUB', 'IF', 'MOT', 'FAV', 'UF'] as const;
