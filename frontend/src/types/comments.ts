export interface CommentData {
    id: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_full_name: string;
    user_avatar?: string;
    user_role: string;
    content: string;
    parent_id?: string;
    likes_count: number;
    is_liked_by_caller: boolean;
    created_at: string;
    updated_at: string;
    replies: CommentData[];
}

/** One page of a thread. `total` counts top-level comments (what pages are made
 *  of); `total_all` includes replies and is the count shown on the thread. */
export interface CommentPage {
    data: CommentData[];
    total: number;
    total_all: number;
    page: number;
    limit: number;
    total_pages: number;
    has_more: boolean;
}
