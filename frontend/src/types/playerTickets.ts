// Player tickets: every player named on a team sheet gets a free ticket, with its
// own code, for that match's game day.

/** Who a player ticket admits, as the gate shows it. */
export interface PlayerTicketHolder {
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

/** One player on a team sheet and their ticket. */
export interface PlayerTicketRow {
    player_id: string;
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
    /** Absent in list views. */
    players?: PlayerTicketRow[];
    named: number;
    issued: number;
    checked_in: number;
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
