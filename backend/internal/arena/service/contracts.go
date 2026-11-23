package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// OfferInput is a manager's contract offer.
type OfferInput struct {
	PlayerID  string `json:"player_id"`
	SquadRole string `json:"squad_role"`
	EndDate   string `json:"end_date"` // yyyy-mm-dd
	FeeNGN    int64  `json:"fee_ngn"`  // recorded only; nothing is charged
	Terms     string `json:"terms"`
}

// managedClub is the club the user manages in the current season.
func (s *Service) managedClub(ctx context.Context, tx *store.Store, userID string) (*domain.Club, *domain.Season, error) {
	season, err := tx.CurrentSeason(ctx)
	if err != nil {
		return nil, nil, badRequest("There is no season yet.")
	}
	club, err := tx.GetClubByManager(ctx, userID, &season.ID)
	if err != nil {
		return nil, nil, forbidden("You don't manage a club.")
	}
	return club, season, nil
}

func transferWindowOpen(season *domain.Season) error {
	if season.Status == domain.SeasonCompleted || !season.TransferWindowOpen {
		return conflict("%s", domain.ErrWindowClosed.Error()+". Contracts can only be made or signed while it is open.")
	}
	return nil
}

// contractError turns a domain rule failure into a 400.
func contractError(err error) error {
	if err == nil {
		return nil
	}
	return badRequest("%s", capitalise(err.Error())+".")
}

func capitalise(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// MakeOffer lets a club manager offer a contract. A free agent receives it
// straight away; a registered player's current club must release them first.
func (s *Service) MakeOffer(ctx context.Context, userID string, in OfferInput) (*domain.Contract, error) {
	var contractID string
	var notify func()
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		club, season, err := s.managedClub(ctx, tx, userID)
		if err != nil {
			return err
		}
		if err := transferWindowOpen(season); err != nil {
			return err
		}
		if _, err := tx.DivisionOfClub(ctx, club.ID, season.ID); err != nil {
			return badRequest("%s isn't in a division this season, so it can't sign players yet.", club.Name)
		}
		end, perr := time.Parse("2006-01-02", in.EndDate)
		if perr != nil {
			return badRequest("Choose a contract end date.")
		}
		var seasonEnd *time.Time
		if season.EndsOn != nil {
			if t, perr := time.Parse("2006-01-02", *season.EndsOn); perr == nil {
				seasonEnd = &t
			}
		}
		role := in.SquadRole
		if role == "" {
			role = domain.RoleFirstTeam
		}
		terms := domain.ContractTerms{SquadRole: role, EndDate: end, FeeNGN: in.FeeNGN, Terms: in.Terms}
		if err := domain.ValidateTerms(terms, s.today(), seasonEnd); err != nil {
			return contractError(err)
		}

		if err := tx.LockPlayer(ctx, in.PlayerID); err != nil {
			return badRequest("That player doesn't exist.")
		}
		player, err := tx.GetPlayer(ctx, in.PlayerID)
		if err != nil {
			return err
		}
		if player.ClubID != nil && *player.ClubID == club.ID {
			return conflict("%s", domain.ErrAlreadyAtClub.Error()+".")
		}
		open, err := tx.OpenOfferExists(ctx, player.ID, club.ID)
		if err != nil {
			return err
		}
		if open {
			return conflict("%s", domain.ErrOpenOffer.Error()+".")
		}

		status := domain.InitialStatus(player.ClubID)
		contractID, err = tx.CreateContract(ctx, store.NewContract{
			SeasonID: season.ID, PlayerID: player.ID, ClubID: club.ID, FromClubID: player.ClubID,
			SquadRole: role, EndDate: end, FeeNGN: in.FeeNGN, Terms: strings.TrimSpace(in.Terms), Status: status, CreatedBy: userID,
		})
		if err != nil {
			return err
		}
		if err := tx.AddContractEvent(ctx, contractID, "Offer sent by "+club.Name, userID); err != nil {
			return err
		}
		notify = s.offerEmails(ctx, tx, club, player, status)
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	if notify != nil {
		notify()
	}
	return s.store.GetContract(ctx, contractID)
}

// offerEmails prepares the emails for a new offer, to send once it is committed.
func (s *Service) offerEmails(ctx context.Context, tx *store.Store, club *domain.Club, player *domain.Player, status string) func() {
	if status == domain.ContractAwaitingRelease && player.ClubID != nil {
		from, err := tx.GetClub(ctx, *player.ClubID, nil)
		if err != nil || from.ManagerEmail == "" {
			return nil
		}
		to := from.ManagerEmail
		return func() {
			s.send(to, club.Name+" wants to sign "+player.Gamertag, "Release request",
				fmt.Sprintf("%s has offered %s a contract. As %s's manager, you need to approve or decline the release first.", esc(club.Name), esc(player.Gamertag), esc(from.Name)),
				"/manage/transfers", "Review the request")
		}
	}
	if player.UserID == nil {
		return nil
	}
	u, err := tx.GetUser(ctx, *player.UserID)
	if err != nil {
		return nil
	}
	return func() {
		s.send(u.Email, club.Name+" sent you a contract offer", "You have a contract offer",
			fmt.Sprintf("%s would like you to join them. Read the terms, then sign or decline.", esc(club.Name)),
			"/me/contracts", "View the offer")
	}
}

// lockedContract locks the offer and its player and returns the fresh contract.
// The player is locked first, always, so two offers for one player can't deadlock.
func (s *Service) lockedContract(ctx context.Context, tx *store.Store, id string) (*domain.Contract, error) {
	k, err := tx.GetContract(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := tx.LockPlayer(ctx, k.PlayerID); err != nil {
		return nil, err
	}
	if err := tx.LockContract(ctx, id); err != nil {
		return nil, err
	}
	return tx.GetContract(ctx, id)
}

// ApproveRelease is the player's current club agreeing to let them go.
func (s *Service) ApproveRelease(ctx context.Context, userID, contractID string) (*domain.Contract, error) {
	var notify func()
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		club, season, err := s.managedClub(ctx, tx, userID)
		if err != nil {
			return err
		}
		if err := transferWindowOpen(season); err != nil {
			return err
		}
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if k.FromClubID == nil || *k.FromClubID != club.ID {
			return forbidden("Only the player's current club can answer this request.")
		}
		next, terr := domain.ApproveRelease(k.Status)
		if terr != nil {
			return contractError(terr)
		}
		if err := tx.SetContractStatus(ctx, k.ID, next, ""); err != nil {
			return err
		}
		if err := tx.AddContractEvent(ctx, k.ID, "Release approved by "+club.Name, userID); err != nil {
			return err
		}
		notify = s.playerEmail(ctx, tx, k.PlayerID, k.ClubName+" sent you a contract offer", "You have a contract offer",
			fmt.Sprintf("%s has released you, so %s's offer is now waiting for you.", esc(club.Name), esc(k.ClubName)))
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	if notify != nil {
		notify()
	}
	return s.store.GetContract(ctx, contractID)
}

// DeclineRelease is the player's current club refusing to let them go.
func (s *Service) DeclineRelease(ctx context.Context, userID, contractID, reason string) (*domain.Contract, error) {
	var notify func()
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		club, _, err := s.managedClub(ctx, tx, userID)
		if err != nil {
			return err
		}
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if k.FromClubID == nil || *k.FromClubID != club.ID {
			return forbidden("Only the player's current club can answer this request.")
		}
		next, terr := domain.DeclineRelease(k.Status)
		if terr != nil {
			return contractError(terr)
		}
		if err := tx.SetContractStatus(ctx, k.ID, next, limit(reason, 300)); err != nil {
			return err
		}
		if err := tx.AddContractEvent(ctx, k.ID, "Release declined by "+club.Name, userID); err != nil {
			return err
		}
		notify = s.managerEmailByClub(ctx, tx, k.ClubID, "Release declined", club.Name+" declined to release "+k.PlayerName,
			fmt.Sprintf("%s declined to release %s, so your offer has ended.", esc(club.Name), esc(k.PlayerName)))
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	if notify != nil {
		notify()
	}
	return s.store.GetContract(ctx, contractID)
}

// WithdrawOffer is the offering club taking back an offer that is still open.
func (s *Service) WithdrawOffer(ctx context.Context, userID, contractID string) (*domain.Contract, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		club, _, err := s.managedClub(ctx, tx, userID)
		if err != nil {
			return err
		}
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if k.ClubID != club.ID {
			return forbidden("Only the club that made an offer can withdraw it.")
		}
		return s.withdraw(ctx, tx, k, "Offer withdrawn by "+club.Name, userID)
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	return s.store.GetContract(ctx, contractID)
}

// AdminWithdrawOffer lets staff close any open offer (for example one that is stuck).
func (s *Service) AdminWithdrawOffer(ctx context.Context, staffUserID, contractID string) (*domain.Contract, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		return s.withdraw(ctx, tx, k, "Offer closed by Arena staff", staffUserID)
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	return s.store.GetContract(ctx, contractID)
}

func (s *Service) withdraw(ctx context.Context, tx *store.Store, k *domain.Contract, label, actor string) error {
	next, terr := domain.Withdraw(k.Status)
	if terr != nil {
		return contractError(terr)
	}
	if err := tx.SetContractStatus(ctx, k.ID, next, ""); err != nil {
		return err
	}
	return tx.AddContractEvent(ctx, k.ID, label, actor)
}

// RejectOffer is the player turning an offer down.
func (s *Service) RejectOffer(ctx context.Context, userID, contractID, reason string) (*domain.Contract, error) {
	var notify func()
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		player, err := tx.GetPlayerByUser(ctx, userID)
		if err != nil {
			return forbidden("You don't have a player profile.")
		}
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if k.PlayerID != player.ID {
			return forbidden("This offer isn't yours.")
		}
		next, terr := domain.RejectOffer(k.Status)
		if terr != nil {
			return contractError(terr)
		}
		if err := tx.SetContractStatus(ctx, k.ID, next, limit(reason, 300)); err != nil {
			return err
		}
		if err := tx.AddContractEvent(ctx, k.ID, player.Gamertag+" rejected the offer", userID); err != nil {
			return err
		}
		notify = s.managerEmailByClub(ctx, tx, k.ClubID, "Offer rejected", player.Gamertag+" rejected your offer",
			fmt.Sprintf("%s turned down %s's contract offer.", esc(player.Gamertag), esc(k.ClubName)))
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	if notify != nil {
		notify()
	}
	return s.store.GetContract(ctx, contractID)
}

// SignInput is the player's signature: their gamertag typed out, and consent.
type SignInput struct {
	Signature string `json:"signature"`
	Consent   bool   `json:"consent"`
}

// SignContract is the player accepting an offer. It moves their registration to
// the new club, gives them a shirt number, closes their other offers and sends
// their old club's affected team sheets back to draft, all in one transaction.
func (s *Service) SignContract(ctx context.Context, userID, contractID string, in SignInput) (*domain.Contract, error) {
	var notifies []func()
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		player, err := tx.GetPlayerByUser(ctx, userID)
		if err != nil {
			return forbidden("You don't have a player profile.")
		}
		k, err := s.lockedContract(ctx, tx, contractID)
		if err != nil {
			return err
		}
		if k.PlayerID != player.ID {
			return forbidden("This offer isn't yours.")
		}
		season, err := tx.GetSeason(ctx, k.SeasonID)
		if err != nil {
			return err
		}
		if err := transferWindowOpen(season); err != nil {
			return err
		}
		if _, terr := domain.Sign(k.Status); terr != nil {
			return contractError(terr)
		}
		if err := domain.CheckSignature(in.Signature, player.Gamertag, in.Consent); err != nil {
			return contractError(err)
		}
		if end, perr := time.Parse("2006-01-02", k.EndDate); perr == nil && end.Before(s.today()) {
			return conflict("This offer's end date has passed. Ask the club for a new one.")
		}

		// The player must still be where they were when the offer was made.
		current, rerr := tx.OpenRegistration(ctx, player.ID)
		var currentClub *string
		if rerr == nil {
			currentClub = &current.ClubID
		}
		if !sameStringPtr(currentClub, k.FromClubID) {
			return conflict("Your club registration has changed since this offer was made. Ask the club for a new offer.")
		}

		preferred := 0
		if current != nil {
			preferred = current.ShirtNumber
			if err := tx.EndRegistration(ctx, player.ID); err != nil {
				return err
			}
		}
		taken, err := tx.TakenShirts(ctx, k.ClubID)
		if err != nil {
			return err
		}
		shirt := domain.PickShirtNumber(preferred, taken)
		if shirt == 0 {
			return conflict("%s has no free shirt numbers.", k.ClubName)
		}
		if err := tx.CreateRegistration(ctx, player.ID, k.ClubID, k.SeasonID, shirt, k.SquadRole, &k.ID); err != nil {
			return err
		}
		if err := tx.MarkSigned(ctx, k.ID, strings.TrimSpace(in.Signature)); err != nil {
			return err
		}
		if err := tx.AddContractEvent(ctx, k.ID, "Contract signed by "+player.Gamertag+"; registration updated", userID); err != nil {
			return err
		}

		closed, err := tx.WithdrawOtherOpenOffers(ctx, player.ID, k.ID)
		if err != nil {
			return err
		}
		for _, id := range closed {
			if err := tx.AddContractEvent(ctx, id, "Closed because the player signed another offer", ""); err != nil {
				return err
			}
		}

		if k.FromClubID != nil {
			if err := s.afterPlayerLeaves(ctx, tx, *k.FromClubID, player.ID, "A player moved to another club; review this team sheet."); err != nil {
				return err
			}
			notifies = append(notifies, s.managerEmailByClub(ctx, tx, *k.FromClubID, "Player transferred", player.Gamertag+" left your club",
				fmt.Sprintf("%s signed for %s. Any team sheet that named them has been reopened for you to review.", esc(player.Gamertag), esc(k.ClubName))))
		}
		notifies = append(notifies, s.managerEmailByClub(ctx, tx, k.ClubID, "Contract signed", player.Gamertag+" signed for you",
			fmt.Sprintf("%s accepted your offer and is now in your squad.", esc(player.Gamertag))))
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	for _, n := range notifies {
		if n != nil {
			n()
		}
	}
	return s.store.GetContract(ctx, contractID)
}

func sameStringPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func limit(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[:n]
	}
	return s
}

// playerEmail prepares an email to a player's account, if they have one.
func (s *Service) playerEmail(ctx context.Context, tx *store.Store, playerID, subject, heading, body string) func() {
	p, err := tx.GetPlayer(ctx, playerID)
	if err != nil || p.UserID == nil {
		return nil
	}
	u, err := tx.GetUser(ctx, *p.UserID)
	if err != nil {
		return nil
	}
	return func() { s.send(u.Email, subject, heading, body, "/me/contracts", "View the offer") }
}

// managerEmailByClub prepares an email to a club's manager, if it has one.
func (s *Service) managerEmailByClub(ctx context.Context, tx *store.Store, clubID, heading, subject, body string) func() {
	c, err := tx.GetClub(ctx, clubID, nil)
	if err != nil || c.ManagerEmail == "" {
		return nil
	}
	to := c.ManagerEmail
	return func() { s.send(to, subject, heading, body, "/manage/transfers", "Open transfers") }
}

// ---- reading contracts -------------------------------------------------------

// ClubContracts lists the offers a manager made or must answer.
func (s *Service) ClubContracts(ctx context.Context, userID, status string) ([]domain.Contract, error) {
	club, season, err := s.managedClub(ctx, s.store, userID)
	if err != nil {
		return nil, err
	}
	out, err := s.store.ListContracts(ctx, store.ContractFilter{SeasonID: season.ID, ClubID: club.ID, Status: status})
	return out, s.wrap(err, "contracts")
}

// PlayerContracts lists the offers made to the caller.
func (s *Service) PlayerContracts(ctx context.Context, userID string) ([]domain.Contract, error) {
	p, err := s.store.GetPlayerByUser(ctx, userID)
	if err != nil {
		return []domain.Contract{}, nil
	}
	out, err := s.store.ListContracts(ctx, store.ContractFilter{PlayerID: p.ID})
	return out, s.wrap(err, "contracts")
}

// GetContractFor returns one offer if the user is the player, the offering club's
// manager, or the player's current club's manager.
func (s *Service) GetContractFor(ctx context.Context, userID, contractID string) (*domain.Contract, error) {
	k, err := s.store.GetContract(ctx, contractID)
	if err != nil {
		return nil, s.wrap(err, "Contract")
	}
	if p, err := s.store.GetPlayerByUser(ctx, userID); err == nil && p.ID == k.PlayerID {
		return k, nil
	}
	if club, _, err := s.managedClub(ctx, s.store, userID); err == nil {
		if club.ID == k.ClubID || (k.FromClubID != nil && *k.FromClubID == club.ID) {
			return k, nil
		}
	}
	return nil, notFoundErr("Contract")
}

// AdminContracts lists every offer in a season for staff.
func (s *Service) AdminContracts(ctx context.Context, status string) ([]domain.Contract, error) {
	season, err := s.currentSeason(ctx)
	if err != nil {
		return nil, err
	}
	out, err := s.store.ListContracts(ctx, store.ContractFilter{SeasonID: season.ID, Status: status, Limit: 500})
	return out, s.wrap(err, "contracts")
}

// FreeAgents lists players with no club, for managers looking to sign someone.
func (s *Service) FreeAgents(ctx context.Context, query string) ([]domain.Player, error) {
	out, err := s.store.ListPlayers(ctx, store.PlayerFilter{FreeAgents: true, Query: query, Limit: 100})
	return out, s.wrap(err, "players")
}

// SearchPlayers finds any player by gamertag, for making an offer to someone at another club.
func (s *Service) SearchPlayers(ctx context.Context, query string) ([]domain.Player, error) {
	if len(strings.TrimSpace(query)) < 2 {
		return []domain.Player{}, nil
	}
	out, err := s.store.ListPlayers(ctx, store.PlayerFilter{Query: query, Limit: 20})
	return out, s.wrap(err, "players")
}
