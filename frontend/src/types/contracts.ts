export interface ContractData {
    id: string;
    player_id: string;
    team_id: string;
    status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'REJECTED';
    contract_length: number;
    matches_at_start: number;
    matches_played: number;
    matches_remaining: number;
    player_value: number;
    offered_by?: string;
    offered_at: string;
    accepted_at?: string;
    expired_at?: string;
    terminated_at?: string;
    termination_reason?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    player?: {
        id: string;
        name: string;
        jersey_number: number;
        position: string;
        image: string;
    };
    team?: {
        id: string;
        name: string;
        short_name: string;
        logo: string;
    };
}

export interface IssueContractPayload {
    player_id: string;
    contract_length?: number;
    player_value?: number;
    notes?: string;
}

export type OfferResponse = { contract: ContractData; action: 'accept' | 'reject' };
