export interface LiveStatus {
    is_live: boolean;
    is_video?: boolean;
    mode?: 'auto' | 'on' | 'off' | 'video';
    video_id?: string;
    title?: string;
    /** 'auto' = detected from the channel, 'manual' = an admin override decided it. */
    source: 'auto' | 'manual';
}

export interface AdminLiveStatus extends LiveStatus {
    mode: 'auto' | 'on' | 'off' | 'video';
    override_video_id: string;
    override_title: string;
    detected_live: boolean;
    detected_video_id?: string;
    detected_title?: string;
    channel_handle: string;
}
