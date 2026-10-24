package services

import (
	"context"
	"fmt"
	"net/mail"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

// Extra tickets, revoking and restoring: how a team manager spends the slots a
// team has for a match beyond the players on the sheet and the managers.

// AddExtra gives one of the team's slots to someone not on the sheet: a reserve
// from the roster, or anyone else by name (another manager, a physio). It is
// emailed to them when an address is given.
func (s *PlayerTicketService) AddExtra(ctx context.Context, matchID, teamID string, req dto.AddExtraTicketRequest) (*dto.PlayerTicketSheetResponse, error) {
	m, teamName, _, err := s.loadMatch(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	if !canIssuePlayerTickets(m, s.now()) {
		return nil, ErrTicketsClosed
	}

	h := ticketHolder{Role: domain.TeamRoleExtra, Name: strings.TrimSpace(req.Name), Email: strings.TrimSpace(req.Email)}
	if req.PlayerID != "" {
		p, err := s.repo.RosterPlayer(ctx, req.PlayerID, teamID)
		if err != nil {
			return nil, err
		}
		if p == nil {
			return nil, ErrNotOnTeam
		}
		h.PlayerID, h.Name = p.PlayerID, p.Name
		// The player's own address wins; one typed for them fills a blank.
		if p.Email != "" {
			h.Email = p.Email
		}
	}
	if h.Name == "" {
		return nil, ErrNeedAName
	}
	if h.Email != "" {
		if _, err := mail.ParseAddress(h.Email); err != nil {
			return nil, ErrBadEmail
		}
	}

	dayID, err := s.repo.EnsureGameDay(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to find the match day: %w", err)
	}

	var ticket *domain.Ticket
	err = s.repo.WithTeamLock(ctx, matchID, teamID, func(ctx context.Context) error {
		live, err := s.repo.LiveTickets(ctx, matchID, teamID)
		if err != nil {
			return err
		}
		if len(live) >= TeamTicketSlots {
			return ErrNoSlotsLeft
		}
		if h.PlayerID != "" {
			for _, t := range live {
				if t.PlayerID != nil && *t.PlayerID == h.PlayerID {
					return ErrAlreadyHasTicket
				}
			}
		}
		ticket, err = s.issue(ctx, m, teamID, dayID, h)
		if err != nil {
			return err
		}
		if ticket == nil {
			return ErrAlreadyHasTicket
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.send(ctx, ticket, m, teamName)
	return s.Sheet(ctx, matchID, teamID)
}

// Revoke takes a ticket back. Its slot is free again for the manager to give to
// someone else, and saving the sheet does not hand it out a second time.
func (s *PlayerTicketService) Revoke(ctx context.Context, matchID, teamID, ticketID string) (*dto.PlayerTicketSheetResponse, error) {
	if _, _, _, err := s.loadMatch(ctx, matchID, teamID); err != nil {
		return nil, err
	}
	t, err := s.tickets.GetByID(ctx, ticketID)
	if err != nil || t.PurchaseType != domain.PurchaseTypePlayer ||
		t.MatchID == nil || *t.MatchID != matchID || t.TeamID == nil || *t.TeamID != teamID {
		return nil, ErrTicketNotFound
	}
	switch t.Status {
	case domain.TicketStatusPaid:
	case domain.TicketStatusUsed:
		return nil, ErrTicketUsed
	default:
		return nil, ErrTicketNotFound
	}
	revoked, err := s.repo.Revoke(ctx, ticketID, matchID, teamID)
	if err != nil {
		return nil, err
	}
	if !revoked {
		return nil, ErrTicketUsed // checked in between the read and the update
	}
	return s.Sheet(ctx, matchID, teamID)
}

// Restore gives a revoked ticket back to a player on the sheet or a manager of the
// team, with a new code.
func (s *PlayerTicketService) Restore(ctx context.Context, matchID, teamID string, req dto.RestoreTicketRequest) (*dto.PlayerTicketSheetResponse, error) {
	m, teamName, _, err := s.loadMatch(ctx, matchID, teamID)
	if err != nil {
		return nil, err
	}
	if !canIssuePlayerTickets(m, s.now()) {
		return nil, ErrTicketsClosed
	}

	var h ticketHolder
	switch {
	case req.PlayerID != "":
		players, err := s.repo.SheetPlayers(ctx, matchID, teamID)
		if err != nil {
			return nil, err
		}
		for _, p := range players {
			if p.PlayerID == req.PlayerID {
				h = playerHolder(p, domain.TeamRolePlayer)
			}
		}
	case req.UserID != "":
		managers, err := s.repo.Managers(ctx, teamID)
		if err != nil {
			return nil, err
		}
		for _, mg := range managers {
			if mg.UserID == req.UserID {
				h = managerHolder(mg)
			}
		}
	}
	if h.Name == "" {
		return nil, ErrNotOnSheetOrTeam
	}

	dayID, err := s.repo.EnsureGameDay(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to find the match day: %w", err)
	}
	var ticket *domain.Ticket
	err = s.repo.WithTeamLock(ctx, matchID, teamID, func(ctx context.Context) error {
		if err := s.repo.ClearRevoked(ctx, matchID, teamID, h.PlayerID, h.UserID); err != nil {
			return err
		}
		var err error
		ticket, err = s.issue(ctx, m, teamID, dayID, h)
		if err != nil {
			return err
		}
		if ticket == nil {
			return ErrAlreadyHasTicket
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.send(ctx, ticket, m, teamName)
	return s.Sheet(ctx, matchID, teamID)
}
