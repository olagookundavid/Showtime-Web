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
    videos: ReliveVideo[];
}
