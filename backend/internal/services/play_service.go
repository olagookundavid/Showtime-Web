package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// ErrPBPLocked is returned when a play-log mutation is attempted on a match
// whose play-by-play is locked. Handlers map it to HTTP 423 (Locked).
var ErrPBPLocked = errors.New("play-by-play is locked for this match — ask an admin to unlock it before editing plays")

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

	// Per-match play-by-play lock (audited via the global middleware).
	SetPBPLock(ctx context.Context, matchID string, locked bool) error

	// ReDeriveSituations rewrites the down/distance/possession/drive of a set of
	// plays (used after a mid-sequence insert), then recomputes the score.
	ReDeriveSituations(ctx context.Context, matchID string, updates []dto.SituationUpdate) error

	// RecomputeAllStats re-derives stats for every match that has a play log.
	RecomputeAllStats(ctx context.Context, competitionID string, dryRun bool) (dto.BulkRecomputeResult, error)
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

// ensureUnlocked blocks play-log mutations while the match is locked.
func (s *PlayService) ensureUnlocked(ctx context.Context, matchID string) error {
	m, err := s.matchRepo.GetMatchByID(ctx, matchID)
	if err != nil {
		return err
	}
	if m.PBPLocked {
		return ErrPBPLocked
	}
	return nil
}

// SetPBPLock locks or unlocks play-by-play editing for a single match.
func (s *PlayService) SetPBPLock(ctx context.Context, matchID string, locked bool) error {
	return s.matchRepo.SetMatchPBPLock(ctx, matchID, locked)
}

// syncDerived brings everything that hangs off the play log back in step after a
// mutation: the running score, then the player/team stats. Stats are live now —
// there is no manual "commit stats" step — so this runs on every play
// create/update/delete/reorder.
//
// Both passes are full rebuilds from the entire log rather than incremental
// updates, which is exactly what keeps repeated calls idempotent: they overwrite
// the match's rows instead of accumulating onto them, so running this after every
// single play can never double-count.
//
// Failures are logged, not returned. The play itself is already written and the
// play log is the source of truth — a stats hiccup must never reject the write
// and leave the admin thinking the play didn't save.
func (s *PlayService) syncDerived(ctx context.Context, matchID string) {
	if _, _, err := s.RecomputeScore(ctx, matchID); err != nil {
		log.Printf("[ERROR] play sync: recompute score for match %s: %v", matchID, err)
	}
	if _, err := s.CommitDerivedStats(ctx, matchID); err != nil {
		log.Printf("[ERROR] play sync: commit derived stats for match %s: %v", matchID, err)
	}
}

// ReDeriveSituations applies the client-computed situation snapshots to a batch
// of plays (after a mid-sequence insert shifts everything downstream), then
// recomputes the running score since the down feeds gender-based scoring.
func (s *PlayService) ReDeriveSituations(ctx context.Context, matchID string, updates []dto.SituationUpdate) error {
	if err := s.ensureUnlocked(ctx, matchID); err != nil {
		return err
	}
	for _, u := range updates {
		if err := s.repo.UpdatePlaySituation(ctx, u.ID, u.DriveNo, u.Down, u.ToGo, u.OffenseTeamID); err != nil {
			return err
		}
	}
	// Down feeds gender-based scoring and drive numbers feed the per-QB rating
	// inputs, so both the score and the stats need rebuilding after a re-derive.
	s.syncDerived(ctx, matchID)
	return nil
}

// RecomputeAllStats re-derives and rewrites player + team stats for every match
// that has a play log, so a derivation change (new stat columns, a corrected
// rule) takes effect everywhere at once instead of only on matches someone
// happens to edit afterwards.
//
// Two deliberate safety properties:
//
//  1. Only matches that HAVE plays are touched. Matches whose stats came from
//     the historical Excel import have no play log, so deriving over them would
//     zero real data — they are excluded at the query, not merely skipped here.
//  2. Stats only — this never recomputes scores or standings. A historical
//     match's official result may have been set independently of its log, and
//     silently rewriting published results/standings is not something a stats
//     refresh should ever do.
//
// dryRun reports exactly what would be touched (including each match's play
// count, so a suspiciously thin log is visible) without writing anything.
func (s *PlayService) RecomputeAllStats(ctx context.Context, competitionID string, dryRun bool) (dto.BulkRecomputeResult, error) {
	matches, err := s.repo.ListMatchesWithPlays(ctx, competitionID)
	if err != nil {
		return dto.BulkRecomputeResult{}, err
	}

	res := dto.BulkRecomputeResult{
		DryRun:       dryRun,
		MatchesFound: len(matches),
		Matches:      make([]dto.BulkRecomputeMatch, 0, len(matches)),
	}

	for _, m := range matches {
		row := dto.BulkRecomputeMatch{
			MatchID: m.MatchID,
			Label:   m.Label,
			Date:    m.Date,
			Plays:   m.Plays,
		}
		if dryRun {
			res.Matches = append(res.Matches, row)
			continue
		}
		// One bad match must not abort the run — record it and keep going, so a
		// single broken team sheet can't block every other match from updating.
		players, err := s.CommitDerivedStats(ctx, m.MatchID)
		if err != nil {
			row.Error = err.Error()
			res.Failed++
			log.Printf("[ERROR] bulk stats recompute: match %s (%s): %v", m.MatchID, m.Label, err)
		} else {
			row.Players = players
			res.MatchesUpdated++
			res.PlayersUpdated += players
		}
		res.Matches = append(res.Matches, row)
	}

	return res, nil
}

func (s *PlayService) CreatePlay(ctx context.Context, matchID string, req dto.PlayRequest) (*domain.GamePlay, error) {
	if err := s.ensureUnlocked(ctx, matchID); err != nil {
		return nil, err
	}
	if err := validateCodes(req); err != nil {
		return nil, err
	}

	p := requestToPlay(matchID, req)

	// Order: an explicit seq means "insert here" — open a gap by bumping every
	// play at/after that position up by one, so a missed play can be slotted into
	// the middle instead of only appended. No seq = append after the last play.
	if req.Seq != nil {
		if err := s.repo.ShiftSeqsForInsert(ctx, matchID, *req.Seq); err != nil {
			return nil, err
		}
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
	// Sync before reloading so the returned play carries its fresh score snapshot.
	s.syncDerived(ctx, matchID)
	res, err := s.reload(ctx, matchID, p.ID)
	if err == nil && res != nil {
		GlobalSSEBroker.Broadcast(matchID, "play_added", res)
	}
	return res, err
}

func (s *PlayService) UpdatePlay(ctx context.Context, matchID, playID string, req dto.PlayRequest) (*domain.GamePlay, error) {
	if err := s.ensureUnlocked(ctx, matchID); err != nil {
		return nil, err
	}
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
	s.syncDerived(ctx, matchID)
	res, err := s.reload(ctx, matchID, p.ID)
	if err == nil && res != nil {
		GlobalSSEBroker.Broadcast(matchID, "play_updated", res)
	}
	return res, err
}

func (s *PlayService) DeletePlay(ctx context.Context, matchID, playID string) error {
	if err := s.ensureUnlocked(ctx, matchID); err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, playID); err != nil {
		return err
	}
	s.syncDerived(ctx, matchID)
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
		CenterID:        blankToNil(req.CenterID),
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
