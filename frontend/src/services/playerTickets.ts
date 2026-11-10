import api from "./client";
import type {
  AddExtraTicketPayload,
  MyPlayerTicket,
  PlayerTicketDay,
  PlayerTicketDaySheets,
  PlayerTicketIssueResult,
  PlayerTicketSheet,
  RestoreTicketPayload,
} from "../types";

// Every player named on a team sheet gets a ticket with their own code. A team
// head's calls are scoped to their team; team-portal admins pass the team.

export const getMyPlayerTicketSheets = async (
  teamId?: string,
): Promise<PlayerTicketSheet[]> => {
  const response = await api.get<{ data: PlayerTicketSheet[] }>(
    "/team-head/player-tickets",
    { params: { team_id: teamId } },
  );
  return response.data.data || [];
};

export const getMyPlayerTicketSheet = async (
  matchId: string,
  teamId?: string,
): Promise<PlayerTicketSheet> => {
  const response = await api.get<PlayerTicketSheet>(
    `/team-head/player-tickets/${matchId}`,
    { params: { team_id: teamId } },
  );
  return response.data;
};

export const issueMyPlayerTickets = async (
  matchId: string,
  teamId?: string,
): Promise<PlayerTicketIssueResult> => {
  const response = await api.post<PlayerTicketIssueResult>(
    `/team-head/player-tickets/${matchId}/issue`,
    null,
    { params: { team_id: teamId } },
  );
  return response.data;
};

export const addMyExtraTicket = async (
  matchId: string,
  payload: AddExtraTicketPayload,
  teamId?: string,
): Promise<PlayerTicketSheet> => {
  const response = await api.post<PlayerTicketSheet>(
    `/team-head/player-tickets/${matchId}/extras`,
    payload,
    { params: { team_id: teamId } },
  );
  return response.data;
};

export const revokeMyTicket = async (
  matchId: string,
  ticketId: string,
  teamId?: string,
): Promise<PlayerTicketSheet> => {
  const response = await api.delete<PlayerTicketSheet>(
    `/team-head/player-tickets/${matchId}/tickets/${ticketId}`,
    { params: { team_id: teamId } },
  );
  return response.data;
};

export const restoreMyTicket = async (
  matchId: string,
  payload: RestoreTicketPayload,
  teamId?: string,
): Promise<PlayerTicketSheet> => {
  const response = await api.post<PlayerTicketSheet>(
    `/team-head/player-tickets/${matchId}/restore`,
    payload,
    { params: { team_id: teamId } },
  );
  return response.data;
};

export const adminGetPlayerTicketDays = async (): Promise<PlayerTicketDay[]> => {
  const response = await api.get<{ data: PlayerTicketDay[] }>(
    "/admin/player-tickets/days",
  );
  return response.data.data || [];
};

export const adminGetPlayerTicketDaySheets = async (
  dayId: string,
): Promise<PlayerTicketDaySheets> => {
  const response = await api.get<PlayerTicketDaySheets>(
    `/admin/player-tickets/days/${dayId}`,
  );
  return response.data;
};

export const adminIssuePlayerTickets = async (
  matchId: string,
  teamId: string,
): Promise<PlayerTicketIssueResult> => {
  const response = await api.post<PlayerTicketIssueResult>(
    `/admin/player-tickets/matches/${matchId}/teams/${teamId}/issue`,
  );
  return response.data;
};

// The signed-in player's own tickets, split out of the old playerPortalApi.
export const getMyTickets = async (): Promise<MyPlayerTicket[]> => {
  const res = await api.get<{ data: MyPlayerTicket[] }>(
    "/player-portal/tickets",
  );
  return res.data.data || [];
};
