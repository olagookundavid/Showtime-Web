package service

import (
	"context"
	"errors"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// Me is what the Arena app needs to know about the signed-in user.
type Me struct {
	// Player is their own player profile, if they have made one.
	Player *domain.Player `json:"player"`
	// ManagedClub is the club they manage this season, if any.
	ManagedClub *domain.Club `json:"managed_club"`
	// FollowedClubID is the club they chose as "my club".
	FollowedClubID string `json:"followed_club_id"`
	// OpenOffers is how many contract offers wait on them as a player.
	OpenOffers int `json:"open_offers"`
	// PendingReleases is how many release requests wait on them as a manager.
	PendingReleases int `json:"pending_releases"`
}

func (s *Service) Me(ctx context.Context, userID string) (*Me, error) {
	me := &Me{}
	var err error
	if me.Player, err = s.MyPlayer(ctx, userID); err != nil {
		return nil, err
	}
	if me.Player != nil {
		offers, err := s.store.ListContracts(ctx, store.ContractFilter{PlayerID: me.Player.ID, Status: domain.ContractAwaitingPlayer})
		if err != nil {
			return nil, s.wrap(err, "contracts")
		}
		me.OpenOffers = len(offers)
	}
	if club, season, err := s.managedClub(ctx, s.store, userID); err == nil {
		me.ManagedClub = club
		all, err := s.store.ListContracts(ctx, store.ContractFilter{SeasonID: season.ID, ClubID: club.ID, Status: domain.ContractAwaitingRelease})
		if err != nil {
			return nil, s.wrap(err, "contracts")
		}
		for _, k := range all {
			if k.FromClubID != nil && *k.FromClubID == club.ID {
				me.PendingReleases++
			}
		}
	}
	if id, err := s.store.GetFollow(ctx, userID); err == nil {
		me.FollowedClubID = id
	} else if !errors.Is(err, store.ErrNotFound) {
		return nil, s.wrap(err, "follow")
	}
	return me, nil
}

// Follow makes a club the user's "my club".
func (s *Service) Follow(ctx context.Context, userID, clubID string) error {
	if _, err := s.store.GetClub(ctx, clubID, nil); err != nil {
		return s.wrap(err, "Club")
	}
	return s.wrap(s.store.SetFollow(ctx, userID, clubID), "follow")
}

func (s *Service) Unfollow(ctx context.Context, userID string) error {
	return s.wrap(s.store.DeleteFollow(ctx, userID), "follow")
}
