package service

import (
	"context"
	"errors"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// ManagerClub is the club the signed-in user manages in the current season.
func (s *Service) ManagerClub(ctx context.Context, userID string) (*domain.Club, error) {
	club, _, err := s.managedClub(ctx, s.store, userID)
	return club, err
}

// ClubFixtures are a club's matches that haven't been played, soonest first.
func (s *Service) ClubFixtures(ctx context.Context, clubID string) ([]domain.Match, error) {
	season, err := s.currentSeason(ctx)
	if err != nil {
		return nil, err
	}
	out, err := s.store.ListMatches(ctx, store.MatchFilter{SeasonID: season.ID, ClubID: clubID, State: "upcoming", Limit: 30})
	return out, s.wrap(err, "fixtures")
}

// SheetEditor is everything the team sheet screen needs for one match.
type SheetEditor struct {
	Match      domain.Match       `json:"match"`
	Sheet      domain.TeamSheet   `json:"sheet"`
	Roster     []domain.Player    `json:"roster"`
	Formations []domain.Formation `json:"formations"`
	Locked     bool               `json:"locked"`
	LockReason string             `json:"lock_reason"`
	Errors     []string           `json:"errors"`
}

// sheetLock says why a sheet can't be edited, or "" if it can. Staff (override)
// can still edit a sheet at kick-off, but never after the match is played.
func (s *Service) sheetLock(m *domain.Match, override bool) string {
	if m.Played() {
		return "This match has been played."
	}
	if m.HomeClubID == nil || m.AwayClubID == nil {
		return "This match is waiting for its clubs."
	}
	if !override && m.KickoffAt != nil && !m.KickoffAt.After(s.now()) {
		return "Team sheets lock at kick-off."
	}
	return ""
}

func (s *Service) matchForClub(ctx context.Context, tx *store.Store, matchID, clubID string) (*domain.Match, error) {
	m, err := tx.GetMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}
	if !((m.HomeClubID != nil && *m.HomeClubID == clubID) || (m.AwayClubID != nil && *m.AwayClubID == clubID)) {
		return nil, forbidden("Your club isn't playing in this match.")
	}
	return m, nil
}

func toInput(sh *domain.TeamSheet) domain.SheetInput {
	in := domain.SheetInput{Formation: sh.Formation, Starters: map[int]string{}, Bench: append([]string(nil), sh.Bench...)}
	for _, st := range sh.Starters {
		in.Starters[st.Index] = st.PlayerID
	}
	if sh.CaptainPlayerID != nil {
		in.Captain = *sh.CaptainPlayerID
	}
	return in
}

func fromInput(in domain.SheetInput, base domain.TeamSheet) domain.TeamSheet {
	base.Formation = in.Formation
	f, _ := domain.FormationByName(in.Formation)
	base.Starters = []domain.SheetSlot{}
	for i, pos := range f.Slots {
		if id, ok := in.Starters[i]; ok && id != "" {
			base.Starters = append(base.Starters, domain.SheetSlot{Index: i, Position: pos, PlayerID: id})
		}
	}
	base.Bench = append([]string{}, in.Bench...)
	if in.Captain != "" {
		c := in.Captain
		base.CaptainPlayerID = &c
	} else {
		base.CaptainPlayerID = nil
	}
	return base
}

// GetSheetEditor loads a club's sheet for a match, or an auto-picked draft if the
// club hasn't started one (nothing is saved until they save).
func (s *Service) GetSheetEditor(ctx context.Context, clubID, matchID string, override bool) (*SheetEditor, error) {
	m, err := s.matchForClub(ctx, s.store, matchID, clubID)
	if err != nil {
		return nil, s.wrap(err, "Match")
	}
	roster, err := s.store.Roster(ctx, clubID)
	if err != nil {
		return nil, s.wrap(err, "squad")
	}
	rmap, order, err := s.store.RosterMap(ctx, clubID)
	if err != nil {
		return nil, s.wrap(err, "squad")
	}

	var sheet domain.TeamSheet
	existing, err := s.store.GetSheet(ctx, matchID, clubID)
	switch {
	case err == nil:
		sheet = *existing
	case errors.Is(err, store.ErrNotFound):
		sheet = fromInput(domain.AutoPick(domain.DefaultFormation, order, rmap), domain.TeamSheet{MatchID: matchID, ClubID: clubID, Status: domain.SheetDraft})
	default:
		return nil, s.wrap(err, "team sheet")
	}

	ed := &SheetEditor{Match: *m, Sheet: sheet, Roster: roster, Formations: domain.Formations}
	if reason := s.sheetLock(m, override); reason != "" {
		ed.Locked, ed.LockReason = true, reason
	}
	ed.Errors = domain.ValidateSheet(toInput(&sheet), rmap)
	ed.Sheet.Errors = ed.Errors
	return ed, nil
}

// SheetSave is a manager's changes to a sheet. Submit false saves a draft.
type SheetSave struct {
	Formation string         `json:"formation"`
	Starters  map[int]string `json:"starters"`
	Bench     []string       `json:"bench"`
	Captain   string         `json:"captain"`
	Submit    bool           `json:"submit"`
}

// SaveSheet stores a draft, or submits a complete sheet (which raises its revision).
func (s *Service) SaveSheet(ctx context.Context, clubID, matchID string, in SheetSave, override bool) (*SheetEditor, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockMatch(ctx, matchID); err != nil {
			return err
		}
		m, err := s.matchForClub(ctx, tx, matchID, clubID)
		if err != nil {
			return err
		}
		if reason := s.sheetLock(m, override); reason != "" {
			return conflict("%s", reason)
		}
		rmap, _, err := tx.RosterMap(ctx, clubID)
		if err != nil {
			return err
		}
		si := domain.SheetInput{Formation: in.Formation, Starters: in.Starters, Bench: in.Bench, Captain: in.Captain}
		if si.Starters == nil {
			si.Starters = map[int]string{}
		}
		var errs []string
		if in.Submit {
			errs = domain.ValidateSheet(si, rmap)
		} else {
			errs = domain.ValidateDraft(si, rmap)
		}
		if len(errs) > 0 {
			return badRequest("%s", errs[0])
		}
		f, _ := domain.FormationByName(si.Formation)
		sheetID, err := tx.LockSheet(ctx, matchID, clubID)
		if err != nil {
			return err
		}
		status := domain.SheetDraft
		if in.Submit {
			status = domain.SheetSubmitted
		}
		return tx.SaveSheet(ctx, sheetID, si, f, status, in.Submit, "")
	})
	if err != nil {
		return nil, s.wrap(err, "Team sheet")
	}
	return s.GetSheetEditor(ctx, clubID, matchID, override)
}

// ReopenSheet sends a submitted sheet back to draft so it can be edited again.
func (s *Service) ReopenSheet(ctx context.Context, clubID, matchID string, override bool) (*SheetEditor, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockMatch(ctx, matchID); err != nil {
			return err
		}
		m, err := s.matchForClub(ctx, tx, matchID, clubID)
		if err != nil {
			return err
		}
		if reason := s.sheetLock(m, override); reason != "" {
			return conflict("%s", reason)
		}
		sh, err := tx.GetSheet(ctx, matchID, clubID)
		if err != nil {
			return badRequest("There is no submitted sheet to reopen.")
		}
		if sh.Status != domain.SheetSubmitted {
			return nil
		}
		sheetID, err := tx.LockSheet(ctx, matchID, clubID)
		if err != nil {
			return err
		}
		f, _ := domain.FormationByName(sh.Formation)
		return tx.SaveSheet(ctx, sheetID, toInput(sh), f, domain.SheetDraft, false, "")
	})
	if err != nil {
		return nil, s.wrap(err, "Team sheet")
	}
	return s.GetSheetEditor(ctx, clubID, matchID, override)
}

// AutoPick suggests a lineup for a formation without saving it.
func (s *Service) AutoPick(ctx context.Context, clubID, formation string) (*domain.TeamSheet, error) {
	if _, ok := domain.FormationByName(formation); !ok {
		return nil, badRequest("Choose one of the available formations.")
	}
	rmap, order, err := s.store.RosterMap(ctx, clubID)
	if err != nil {
		return nil, s.wrap(err, "squad")
	}
	sh := fromInput(domain.AutoPick(formation, order, rmap), domain.TeamSheet{ClubID: clubID, Status: domain.SheetDraft})
	return &sh, nil
}
