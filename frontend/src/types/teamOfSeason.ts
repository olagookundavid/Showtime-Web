export interface SeasonGraphic {
    id: string;
    category: 'offense' | 'defense';
    image_url: string;
    mobile_image_url?: string;
}

export interface SeasonMVP {
    id: string;
    player_id: string;
    label: string;
    display_order: number;
    is_active: boolean;
    player_name: string;
    player_image: string;
    player_jersey_number: number;
    player_position: string;
    team_name: string;
    team_logo: string;
}

export interface UpsertSeasonGraphicPayload {
    category: 'offense' | 'defense';
    image_url: string;
    mobile_image_url?: string;
}

export interface CreateSeasonMVPPayload {
    player_id: string;
    label: string;
    display_order?: number;
}

export interface UpdateSeasonMVPPayload {
    label?: string;
    display_order?: number;
    is_active?: boolean;
}
