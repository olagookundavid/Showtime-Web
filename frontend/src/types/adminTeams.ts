// A team head assigned to a team. created_at is when they were assigned.
export interface TeamManager {
    id: string;
    user_id: string;
    team_id: string;
    created_at: string;
    user_full_name?: string;
    user_email?: string;
}

// Every team_head user, with whichever team they currently manage (if any) —
// powers the "Assign Team Head" dropdown so it can show ALL team_head users
// (not just unassigned ones) and explain why a name is greyed out.
export interface ManagerCandidate {
    user_id: string;
    full_name: string;
    email: string;
    assigned_team_id?: string;
    assigned_team_name?: string;
}
