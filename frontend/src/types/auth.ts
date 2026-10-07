export interface AuthUser {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    user_type: string; // 'admin' | 'user' | 'team_head' | 'ticketer'
    email_verified?: boolean;
    created_at: string;
    updated_at: string;
    access_token?: string;
}

export interface ResetPasswordPayload {
    email: string;
    otp: string;
    new_password: string;
}
