import type { Player } from './players';
import type { Competition } from './matches';
import type { News, CreateNewsPayload } from './news';

export interface TOTWPlayerSlot {
    player_id: string;
    slot_code: string;
    position: string;
    unit: 'Offence' | 'Defence';
    coord_x?: string;
    coord_y?: string;
    rating: number;
    stat1_value?: string;
    stat1_label?: string;
    stat2_value?: string;
    stat2_label?: string;
    stat3_value?: string;
    stat3_label?: string;
    is_player_of_the_week?: boolean;
}

export interface TOTWPlayer extends TOTWPlayerSlot {
    id: string;
    totw_id: string;
    display_order: number;
    player?: Player;
}

export interface TeamOfTheWeek {
    id: string;
    competition_id: string;
    event_day_id?: string;
    player_of_the_week_id?: string;
    week_title: string;
    headline: string;
    sub_headline: string;
    news_id?: string | null;
    is_published: boolean;
    published_at?: string;
    created_at: string;
    updated_at: string;
    competition?: Competition;
    news?: News | null;
    players: TOTWPlayer[];
}

export interface TOTWListItem {
    id: string;
    competition_id: string;
    competition_name?: string;
    competition_logo?: string;
    event_day_id?: string;
    player_of_the_week_id?: string;
    week_title: string;
    headline: string;
    sub_headline?: string;
    news_id?: string | null;
    is_published: boolean;
    published_at?: string;
    created_at: string;
}

export interface SaveTOTWPayload {
    competition_id: string;
    event_day_id?: string;
    player_of_the_week_id?: string;
    week_title: string;
    headline: string;
    sub_headline?: string;
    news_id?: string | null;
    news_article?: CreateNewsPayload;
    is_published: boolean;
    players: TOTWPlayerSlot[];
}
