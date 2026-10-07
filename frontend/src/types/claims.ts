export interface ClaimablePlayerData {
    id: string;
    name: string;
    jersey_number?: number;
    position?: string;
}

export interface VerifyClaimCodeData {
    team_id: string;
    team_name: string;
    team_logo?: string;
    players: ClaimablePlayerData[];
}

export interface SubmitClaimPayload {
    code: string;
    email: string;
    password: string;
    phone?: string;
    player_id?: string;
    full_name?: string;
    proposed_jersey_number?: number;
    proposed_position?: string;
}

export interface SubmitClaimData {
    claim_id: string;
    status: string;
    access_token?: string;
    user_id: string;
    user_type: string;
    message: string;
}

export interface MyClaimStatusData {
    has_claim: boolean;
    claim_id?: string;
    claim_kind?: ClaimKind;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    team_name?: string;
    player_name?: string;
    claimed_email?: string;
    claimed_phone?: string;
    claimed_photo?: string;
    email_verified: boolean;
    reject_reason?: string;
    created_at?: string;
}

export type ClaimKind = 'ROSTER' | 'NEW_PLAYER';
export type ClaimEndorsement = 'ENDORSED' | 'DECLINED';

export interface PlayerClaimData {
    id: string;
    player_id?: string;
    team_id: string;
    team_name?: string;
    // ROSTER claims are the team manager's to decide. NEW_PLAYER requests — from
    // people not on the roster — are decided by the league office; a manager's part
    // is to endorse or decline, which is advisory.
    claim_kind: ClaimKind;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';

    endorsement?: ClaimEndorsement;
    endorsed_by_name?: string;
    endorsed_at?: string;
    endorsement_note?: string;

    claimed_email: string;
    claimed_phone?: string;
    claimed_photo?: string;
    email_verified: boolean;

    is_new_player_request: boolean;
    proposed_name?: string;
    proposed_jersey_number?: number;
    proposed_position?: string;

    player_name?: string;
    player_jersey_number?: number;
    player_position?: string;
    player_image?: string;
    past_teams?: string[];
    matches_played: number;

    reject_reason?: string;
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
}

export interface ClaimCodeData {
    id: string;
    team_id: string;
    team_name?: string;
    code: string;
    expires_at?: string;
    max_uses: number;
    uses: number;
    revoked: boolean;
    created_at: string;
}
