import type { Competition } from './matches';

export interface Gallery {
    id: string;
    competition_id?: string | null;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
    created_at: string;
    competition?: Competition | null;
}

export interface CreateGalleryPayload {
    competition_id?: string | null;
    game_week: string;
    date: string;
    players_photo_url: string;
    fans_photo_url: string;
}
