package services

import (
	"context"
	"errors"
	"fmt"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// The trading side of fantasy: a manager owns a squad and buys and sells out of
// a bank. The lineup they field each match day is drawn from that squad.
type IFantasySquadService interface {
	// GetSquad is the trading dashboard's read: who is owned, what they would
	// fetch, what is left in the bank, and the rules that constrain both.
	GetSquad(ctx context.Context, userID, seasonID string) (*dto.SquadResponse, error)
	BuyPlayer(ctx context.Context, userID, seasonID, playerID string) (*dto.SquadResponse, error)
	SellPlayer(ctx context.Context, userID, seasonID, playerID string) (*dto.SquadResponse, error)
}

type FantasySquadService struct {
	repo        ports.IFantasySquadRepository
	fantasyRepo ports.IFantasyRepository
}

func NewFantasySquadService(
	repo ports.IFantasySquadRepository,
	fantasyRepo ports.IFantasyRepository,
) IFantasySquadService {
	return &FantasySquadService{repo: repo, fantasyRepo: fantasyRepo}
}

// squadContext resolves the things every trade needs: the manager's team, the
// season's rules, and the squad as it stands.
func (s *FantasySquadService) squadContext(ctx context.Context, userID, seasonID string) (
	team *domain.FantasyTeam, season *domain.FantasySeason, squad []domain.SquadPlayer, bank float64, err error,
) {
	season, err = s.fantasyRepo.GetSeasonByID(ctx, seasonID)
	if err != nil {
		return nil, nil, nil, 0, err
	}
	if season == nil {
		return nil, nil, nil, 0, errors.New("season not found")
	}

	team, err = s.fantasyRepo.GetTeamByUserAndSeason(ctx, userID, seasonID)
	if err != nil {
		return nil, nil, nil, 0, err
	}
	if team == nil {
		return nil, nil, nil, 0, errors.New("join this season before building a squad")
	}

	squad, err = s.repo.ListSquad(ctx, team.ID, "")
	if err != nil {
		return nil, nil, nil, 0, err
	}
	bank, err = s.repo.GetBank(ctx, team.ID)
	if err != nil {
		return nil, nil, nil, 0, err
	}
	return team, season, squad, bank, nil
}

// assertTradingOpen refuses a trade while a match day is being played.
//
// The market is open before a gameweek and after it, never during. Once the
// deadline passes and the gameweek locks, squads are frozen until the scores are
// final.
//
// This is what stops a manager watching a player have a bad game and selling the
// damage away — or watching one score and cashing out at a price that has not
// caught up yet. The team sheet was submitted at the deadline, and the team
// sheet is what plays. It also means a sale can no longer reach a lineup that is
// currently being scored, so points always belong to whoever owned the player
// while they earned them.
func (s *FantasySquadService) tradingWindow(ctx context.Context, seasonID string) (open bool, reason string, err error) {
	gw, err := s.fantasyRepo.GetCurrentGameweek(ctx, seasonID)
	if err != nil {
		return false, "", err
	}
	// No gameweek yet, or the season is over: nothing is in progress.
	if gw == nil {
		return true, "", nil
	}
	if gw.Status == domain.GameweekLocked || gw.Status == domain.GameweekLive {
		return false, fmt.Sprintf(
			"the transfer market is closed while gameweek %d is being played — it reopens when the scores are final",
			gw.Number,
		), nil
	}
	return true, "", nil
}

// assertTradingOpen is tradingWindow as a guard. A lookup failure is returned as
// itself rather than being reported to the manager as a closed market.
func (s *FantasySquadService) assertTradingOpen(ctx context.Context, seasonID string) error {
	open, reason, err := s.tradingWindow(ctx, seasonID)
	if err != nil {
		return err
	}
	if !open {
		return errors.New(reason)
	}
	return nil
}

func seasonRules(season *domain.FantasySeason) domain.LineupRules {
	return domain.LineupRules{
		Budget:           season.Budget,
		MinFemaleOffense: season.MinFemaleOffense,
		MinFemaleDefense: season.MinFemaleDefense,
		MaxPerClub:       season.MaxPerClub,
	}
}

func (s *FantasySquadService) GetSquad(ctx context.Context, userID, seasonID string) (*dto.SquadResponse, error) {
	_, season, squad, bank, err := s.squadContext(ctx, userID, seasonID)
	if err != nil {
		return nil, err
	}
	res := buildSquadResponse(squad, bank, season)

	// Report the trading window with the squad, so the dashboard can grey out
	// Buy and Sell and explain itself instead of letting the click fail.
	open, reason, err := s.tradingWindow(ctx, seasonID)
	if err != nil {
		return nil, err
	}
	res.MarketOpen, res.MarketClosedReason = open, reason
	return res, nil
}

// BuyPlayer signs a player at today's market price.
func (s *FantasySquadService) BuyPlayer(ctx context.Context, userID, seasonID, playerID string) (*dto.SquadResponse, error) {
	if err := s.assertTradingOpen(ctx, seasonID); err != nil {
		return nil, err
	}

	team, _, squad, _, err := s.squadContext(ctx, userID, seasonID)
	if err != nil {
		return nil, err
	}

	if len(squad) >= domain.SquadMax {
		return nil, fmt.Errorf("your squad is full at %d players — sell someone before signing another", domain.SquadMax)
	}

	price, _, err := s.repo.GetMarketPlayer(ctx, seasonID, playerID)
	if err != nil {
		return nil, err
	}
	if price <= 0 {
		return nil, errors.New("this player is not on the market for this season")
	}

	// No club cap, no positional quota and no gender rule here: the squad is
	// unrestricted, and every one of those is enforced on the starting fourteen
	// instead. The readiness checklist in the response is what warns a manager
	// that the squad they are assembling cannot field a legal team sheet.
	if err := s.repo.BuyPlayer(ctx, team.ID, playerID, price); err != nil {
		return nil, err
	}
	return s.GetSquad(ctx, userID, seasonID)
}

// SellPlayer releases a player for what they are worth today.
//
// While the market is open, any owned player can be sold, including the last one
// who could fill a slot.
// The squad carries no restrictions; a manager is free to wreck it. What that
// costs them is spelled out before they confirm and again on the checklist
// afterwards — and if the squad falls below fourteen they forfeit the match day
// rather than being stopped from getting there.
func (s *FantasySquadService) SellPlayer(ctx context.Context, userID, seasonID, playerID string) (*dto.SquadResponse, error) {
	if err := s.assertTradingOpen(ctx, seasonID); err != nil {
		return nil, err
	}

	team, _, squad, _, err := s.squadContext(ctx, userID, seasonID)
	if err != nil {
		return nil, err
	}

	var selling *domain.SquadPlayer
	for i := range squad {
		if squad[i].PlayerID == playerID {
			selling = &squad[i]
			break
		}
	}
	if selling == nil {
		return nil, ports.ErrNotOwned
	}

	if _, err := s.repo.SellPlayer(ctx, team.ID, playerID, domain.SellQuote(*selling)); err != nil {
		return nil, err
	}
	return s.GetSquad(ctx, userID, seasonID)
}

// buildSquadResponse carries the rules alongside the squad so the dashboard can
// state them next to the thing they constrain, rather than hard-coding a copy
// that drifts from the season's real settings.
func buildSquadResponse(squad []domain.SquadPlayer, bank float64, season *domain.FantasySeason) *dto.SquadResponse {
	res := &dto.SquadResponse{
		Players:    squad,
		Bank:       bank,
		SquadSize:  len(squad),
		SquadMin:   domain.SquadMin,
		SquadMax:   domain.SquadMax,
		StartingXI: len(domain.AllValidSlots),
		Rules: dto.SquadRules{
			Budget:           season.Budget,
			MinFemaleOffense: season.MinFemaleOffense,
			MinFemaleDefense: season.MinFemaleDefense,
			MaxPerClub:       season.MaxPerClub,
		},
	}
	rules := seasonRules(season)
	res.FemaleOffense, res.FemaleDefense = domain.FemaleCount(squad)

	// Every player is sellable — the squad has no rules to break. What is worked
	// out here is what the sale would cost the manager, so the confirmation can
	// say it before the money moves.
	for i := range squad {
		p := &squad[i]
		p.SellPrice = domain.SellQuote(*p)
		p.CanSell = true
		p.QuotaCritical = quotaCritical(*p, squad, rules)
		p.BreaksLineup = domain.CanFieldLineup(withoutPlayer(squad, p.PlayerID), rules) != nil

		res.SquadValue += p.CurrentPrice
		if p.Starting {
			res.Starters++
		}
	}
	res.Players = squad
	res.Subs = res.SquadSize - res.Starters
	res.Readiness = domain.Readiness(squad, rules)
	return res
}

// withoutPlayer is the squad as it would be after a sale.
func withoutPlayer(squad []domain.SquadPlayer, playerID string) []domain.SquadPlayer {
	out := make([]domain.SquadPlayer, 0, len(squad))
	for _, p := range squad {
		if p.PlayerID != playerID {
			out = append(out, p)
		}
	}
	return out
}

// quotaCritical reports whether selling this woman would leave her unit with no
// margin on the female minimum — the sale is still legal, but one more and the
// squad is stuck. Worth a word before the money changes hands, because buying
// her replacement may cost more than she fetched.
func quotaCritical(p domain.SquadPlayer, squad []domain.SquadPlayer, rules domain.LineupRules) bool {
	if domain.NormalizeGender(p.Gender) != "F" {
		return false
	}
	offense, defense := domain.FemaleCount(withoutPlayer(squad, p.PlayerID))
	if domain.UnitForPosition(p.Position) == domain.UnitOffense {
		return offense <= rules.MinFemaleOffense
	}
	return defense <= rules.MinFemaleDefense
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
