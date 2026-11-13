export interface AppSettingsData {
    app_font_id: string;
    /** Pre-fills the contract length when a team head makes an offer. */
    default_contract_length: number;
}

/** A person who can be chosen to receive the weekly league contract summary. */
export interface SettingsUser {
    user_id: string;
    name: string;
    email: string;
    role: string;
}

export interface ContractSettings {
    default_length: number;
    onboarding_length: number;
    warning_matches: number;
}

export interface NotificationSettings {
    team_summaries_enabled: boolean;
    league_digest_enabled: boolean;
    league_digest_recipients: SettingsUser[];
}

export interface FantasySettings {
    platform_cut_percent: number;
}

/** Everything the App Settings page edits. */
export interface AdminSettings {
    contracts: ContractSettings;
    notifications: NotificationSettings;
    fantasy: FantasySettings;
}

export interface NotificationSettingsPayload {
    team_summaries_enabled: boolean;
    league_digest_enabled: boolean;
    /** User ids. */
    league_digest_recipients: string[];
}
