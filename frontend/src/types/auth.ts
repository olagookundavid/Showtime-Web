export interface AuthUser {
    id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    email: string;
    phone?: string;
    /** The role's permanent key (e.g. 'admin', 'content_creator', or one created in the Roles page). */
    user_type: string;
    /** The role's display name. */
    role_name?: string;
    /** What the role may do in the admin panel: feature -> level. A missing feature means no access. */
    permissions?: Record<string, 'view' | 'full'>;
    /** True when the role can open the admin panel at all. */
    is_staff?: boolean;
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
