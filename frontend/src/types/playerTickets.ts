// Team tickets: every team has TEAM slots for a match. The players on its sheet and
// its managers get one automatically, and the manager can give the rest to anyone
// (a reserve, another manager). Each is a free ticket with its own code.

export type TeamTicketRole = 'PLAYER' | 'MANAGER' | 'EXTRA';

/** Who a player ticket admits, as the gate shows it. */
export interface PlayerTicketHolder {
    /** PLAYER (on the team sheet), MANAGER, or EXTRA (given a ticket by the team manager). */
    role: TeamTicketRole;
    player_id: string;
    name: string;
    jersey_number: number;
    position: string;
    image: string;
    team_id: string;
    team_name: string;
    match_id: string;
    home_team: string;
    away_team: string;
    competition: string;
    /** YYYY-MM-DD */
    match_date?: string;
    /** HH:MM */
    kickoff?: string;
}

export interface PlayerTicketMatch {
    id: string;
    /** YYYY-MM-DD */
    date: string;
    /** HH:MM, absent when not set */
    kickoff?: string;
    status: string;
    venue: string;
    competition: string;
    home_team: string;
    away_team: string;
}

/** One person with a slot for a match, and their ticket. */
export interface PlayerTicketRow {
    role: TeamTicketRole;
    /** Absent for a manager, or an extra who is not on the team's roster. */
    player_id?: string;
    /** Set for a manager. */
    user_id?: string;
    /** The ticket was taken back on purpose: no code, and saving the sheet does not give one. */
    revoked?: boolean;
    name: string;
    jersey_number: number;
    position: string;
    is_starter: boolean;
    /** Whether the ticket could be emailed to them. */
    has_email: boolean;
    ticket_id?: string;
    ticket_code?: string;
    status?: string;
    checked_in_at?: string;
}

/** One team's sheet for one match, with every player's ticket code. */
export interface PlayerTicketSheet {
    match: PlayerTicketMatch;
    team_id: string;
    team_name: string;
    opponent: string;
    /** Players on the sheet. Absent in list views. */
    players?: PlayerTicketRow[];
    /** The team's managers and any extras the manager gave a ticket. Absent in list views. */
    others?: PlayerTicketRow[];
    named: number;
    issued: number;
    /** Everyone owed a ticket (sheet players, managers) who has none and was not revoked. */
    missing: number;
    checked_in: number;
    slots_total: number;
    slots_used: number;
    slots_left: number;
    /** False once the match day has passed. */
    can_issue: boolean;
}

export interface PlayerTicketDay {
    id: string;
    title: string;
    date: string;
    venue: string;
}

export interface PlayerTicketDaySheets {
    day: PlayerTicketDay;
    sheets: PlayerTicketSheet[];
}

export interface PlayerTicketIssueResult {
    sheet: PlayerTicketSheet;
    result: { issued: number; emailed: number; cancelled: number };
    /** Set when some players could not be given a ticket. */
    error?: string;
}

/** One of the signed-in player's own tickets, with the code to show at the gate. */
export interface MyPlayerTicket {
    ticket_id: string;
    ticket_code: string;
    status: string;
    checked_in_at?: string;
    team_name: string;
    opponent: string;
    match: PlayerTicketMatch;
}

/** Gives one of the team's spare slots to a reserve (player_id) or anyone else (name). */
export interface AddExtraTicketPayload {
    player_id?: string;
    name?: string;
    email?: string;
}

/** Gives a revoked ticket back to a player on the sheet (player_id) or a manager (user_id). */
export interface RestoreTicketPayload {
    player_id?: string;
    user_id?: string;
}
