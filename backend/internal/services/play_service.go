package services

import (
	"context"
	"fmt"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IPlayService interface {
	ListByMatch(ctx context.Context, matchID string) ([]*domain.GamePlay, error)
	CreatePlay(ctx context.Context, matchID string, req dto.PlayRequest) (*domain.GamePlay, error)
	UpdatePlay(ctx context.Context, matchID, playID string, req dto.PlayRequest) (*domain.GamePlay, error)
	DeletePlay(ctx context.Context, matchID, playID string) error

	// Step 2 — stat derivation
	DeriveMatchStats(ctx context.Context, matchID string) ([]domain.AggregatedPlayerStat, error)
	CompareMatchStats(ctx context.Context, matchID string) (derived, current []domain.AggregatedPlayerStat, err error)
	CommitDerivedStats(ctx context.Context, matchID string) (int, error)

	// Step 3 — rules config + scoring engine
	GetRulesForMatch(ctx context.Context, matchID string) (domain.GameRules, error)
	GetRules(ctx context.Context, competitionID string) (domain.GameRules, error)
	UpsertRules(ctx context.Context, competitionID string, req dto.GameRulesRequest) (domain.GameRules, error)
	RecomputeScore(ctx context.Context, matchID string) (home, away int, err error)
	CommitScore(ctx context.Context, matchID string) (home, away int, err error)
}

type PlayService struct {
	repo      ports.PlayRepository
	matchRepo ports.MatchRepository
	statsRepo ports.StatsRepository
}

func NewPlayService(repo ports.PlayRepository, matchRepo ports.MatchRepository, statsRepo ports.StatsRepository) IPlayService {
	return &PlayService{repo: repo, matchRepo: matchRepo, statsRepo: statsRepo}
}

func (s *PlayService) ListByMatch(ctx context.Context, matchID string) ([]*domain.GamePlay, error) {
	return s.repo.ListByMatch(ctx, matchID)
}

func (s *PlayService) CreatePlay(ctx context.Context, matchID string, req dto.PlayRequest) (*domain.GamePlay, error) {
	if err := validateCodes(req); err != nil {
		return nil, err
	}

	p := requestToPlay(matchID, req)

	// Order: use the explicit seq if given, otherwise append after the last play.
	if req.Seq != nil {
		p.Seq = *req.Seq
	} else {
		maxSeq, err := s.repo.MaxSeq(ctx, matchID)
		if err != nil {
			return nil, err
		}
		p.Seq = maxSeq + 1
	}

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	res, err := s.reload(ctx, matchID, p.ID)
	if err == nil && res != nil {
		GlobalSSEBroker.Broadcast(matchID, "play_added", res)
	}
	return res, err
}

func (s *PlayService) UpdatePlay(ctx context.Context, matchID, playID string, req dto.PlayRequest) (*domain.GamePlay, error) {
	if err := validateCodes(req); err != nil {
		return nil, err
	}

	p := requestToPlay(matchID, req)
	p.ID = playID

	// Preserve the play's position unless the caller explicitly reorders it.
	if req.Seq != nil {
		p.Seq = *req.Seq
	} else {
		seq, err := s.repo.GetSeq(ctx, playID)
		if err != nil {
			return nil, err
		}
		p.Seq = seq
	}

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	res, err := s.reload(ctx, matchID, p.ID)
	if err == nil && res != nil {
		GlobalSSEBroker.Broadcast(matchID, "play_updated", res)
	}
	return res, err
}

func (s *PlayService) DeletePlay(ctx context.Context, matchID, playID string) error {
	if err := s.repo.Delete(ctx, playID); err != nil {
		return err
	}
	GlobalSSEBroker.Broadcast(matchID, "play_deleted", map[string]string{"id": playID})
	return nil
}

// reload returns the freshly-hydrated play (with player/team names) from the list.
func (s *PlayService) reload(ctx context.Context, matchID, playID string) (*domain.GamePlay, error) {
	plays, err := s.repo.ListByMatch(ctx, matchID)
	if err != nil {
		return nil, err
	}
	for _, pl := range plays {
		if pl.ID == playID {
			return pl, nil
		}
	}
	return nil, fmt.Errorf("play not found after save")
}

// validateCodes rejects unknown play-type / result / penalty codes. Empty values
// are allowed (a game event or penalty-only row need not set all three).
func validateCodes(req dto.PlayRequest) error {
	if v := deref(req.PlayType); v != "" && !domain.PlayTypeCodes[v] {
		return fmt.Errorf("invalid play_type code: %s", v)
	}
	if v := deref(req.Result); v != "" && !domain.ResultCodes[v] {
		return fmt.Errorf("invalid result code: %s", v)
	}
	if v := deref(req.Penalty); v != "" && !domain.PenaltyCodes[v] {
		return fmt.Errorf("invalid penalty code: %s", v)
	}
	return nil
}

func requestToPlay(matchID string, req dto.PlayRequest) *domain.GamePlay {
	p := &domain.GamePlay{
		MatchID:         matchID,
		DriveNo:         derefIntOr(req.DriveNo, 1),
		Quarter:         derefIntOr(req.Quarter, 1),
		Clock:           blankToNil(req.Clock),
		OffenseTeamID:   blankToNil(req.OffenseTeamID),
		Down:            req.Down,
		ToGo:            req.ToGo,
		BallOn:          blankToNil(req.BallOn),
		PlayType:        blankToNil(req.PlayType),
		OffQBID:         blankToNil(req.OffQBID),
		TargetID:        blankToNil(req.TargetID),
		Yards:           req.Yards,
		Result:          blankToNil(req.Result),
		DefenderID:      blankToNil(req.DefenderID),
		RusherID:        blankToNil(req.RusherID),
		Dropped:         req.Dropped != nil && *req.Dropped,
		BattedDown:      req.BattedDown != nil && *req.BattedDown,
		Uncatchable:     req.Uncatchable != nil && *req.Uncatchable,
		ReturnedForTD:   req.ReturnedForTD != nil && *req.ReturnedForTD,
		Penalty:         blankToNil(req.Penalty),
		PenaltyTeamID:   blankToNil(req.PenaltyTeamID),
		PenaltyPlayerID: blankToNil(req.PenaltyPlayerID),
		PenaltyYards:    req.PenaltyYards,
		HomeScoreAfter:  req.HomeScoreAfter,
		AwayScoreAfter:  req.AwayScoreAfter,
		Notes:           blankToNil(req.Notes),
	}
	return p
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

// blankToNil normalises empty/whitespace strings to NULL so optional UUID and
// text columns don't get stored as "".
func blankToNil(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func derefIntOr(i *int, def int) int {
	if i == nil {
		return def
	}
	return *i
}
