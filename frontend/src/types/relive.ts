export interface ReliveVideo {
    id: string;
    video_id: string;
    title: string;
    thumbnail: string;
    max_thumbnail: string;
    published_at: string;
    link: string;
}

export interface RelivePlaylist {
    title: string;
    playlist_id: string;
    /** Empty when the playlist has no videos or YouTube couldn't be reached. */
    videos: ReliveVideo[];
}

/** The playlist the homepage Relive section shows, and how fetching it is going. */
export interface AdminReliveStatus {
    playlist_id: string;
    playlist_url: string;
    /** True until an admin chooses a playlist. */
    is_default: boolean;
    /** From the last successful fetch. */
    title?: string;
    video_count: number;
    fetched_at?: string;
    /** Set while the latest fetch from YouTube has failed. */
    last_error?: string;
    failed_at?: string;
}
