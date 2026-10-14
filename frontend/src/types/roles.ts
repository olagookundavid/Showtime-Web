export type PermissionLevel = 'view' | 'full';

/** A role and what it may do in the admin panel. A feature missing from `permissions` means no access. */
export interface RoleResponse {
    /** Permanent id, used as `users.role`. Never changes, even if the role is renamed. */
    key: string;
    name: string;
    description: string;
    /** Built-in roles with their own portal or flow; they can't be edited or deleted. */
    is_system: boolean;
    permissions: Record<string, PermissionLevel>;
    user_count: number;
    created_at: string;
    updated_at: string;
}

/** A role as offered in a dropdown. */
export interface RoleOption {
    key: string;
    name: string;
    is_system: boolean;
}

/** One admin feature a role can be given access to. */
export interface FeatureDef {
    key: string;
    label: string;
    group: string;
    description: string;
}

export interface SaveRolePayload {
    name: string;
    description: string;
    permissions: Record<string, PermissionLevel>;
}
