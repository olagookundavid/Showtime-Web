export interface NotificationData {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    reference_type?: string;
    reference_id?: string;
    is_read: boolean;
    created_at: string;
}
