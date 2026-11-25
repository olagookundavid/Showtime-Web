package service

import (
	"context"
	"strings"
	"time"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// ---- clubs -----------------------------------------------------------------

type ClubInput struct {
	Name         string `json:"name"`
	Short        string `json:"short"`
	Color        string `json:"color"`
	CrestURL     string `json:"crest_url"`
	FoundedYear  *int   `json:"founded_year"`
	DivisionID   string `json:"division_id"`   // create only: join this division
	ManagerEmail string `json:"manager_email"` // create only
}

func validateClub(in ClubInput) (store.ClubInput, error) {
	name := cleanText(in.Name)
	if len(name) < 2 || len(name) > 45 {
		return store.ClubInput{}, badRequest("Give the club a name of 2 to 45 characters.")
	}
	short := strings.ToUpper(cleanText(in.Short))
	if !shortRe.MatchString(short) {
		return store.ClubInput{}, badRequest("The abbreviation must be 2 or 3 letters or numbers.")
	}
	color := cleanText(in.Color)
	if color == "" {
		color = "#4e7050"
	}
	if !colorRe.MatchString(color) {
		return store.ClubInput{}, badRequest("The club colour must look like #4e7050.")
	}
	crest := cleanText(in.CrestURL)
	if !validCrestURL(crest) {
		return store.ClubInput{}, badRequest("The crest must be an image link starting with https://.")
	}
	if in.FoundedYear != nil && (*in.FoundedYear < 1990 || *in.FoundedYear > time.Now().Year()+1) {
		return store.ClubInput{}, badRequest("Enter a founding year between 1990 and next year.")
	}
	return store.ClubInput{Name: name, Short: short, Color: strings.ToLower(color), CrestURL: crest, FoundedYear: in.FoundedYear}, nil
}

// ClubFilter narrows ListClubs.
type ClubFilter struct {
	DivisionID      string
	Query           string
	IncludeArchived bool
	Unassigned      bool
}

// ListClubs lists clubs with their division in the current season.
func (s *Service) ListClubs(ctx context.Context, f ClubFilter) ([]domain.Club, error) {
	var seasonID *string
	if season, err := s.store.CurrentSeason(ctx); err == nil {
		seasonID = &season.ID
	}
	out, err := s.store.ListClubs(ctx, store.ClubFilter{
		SeasonID: seasonID, DivisionID: f.DivisionID, Query: f.Query, IncludeArchived: f.IncludeArchived, UnassignedOnly: f.Unassigned,
	})
	return out, s.wrap(err, "clubs")
}

func (s *Service) seasonIDPtr(ctx context.Context) *string {
	if season, err := s.store.CurrentSeason(ctx); err == nil {
		return &season.ID
	}
	return nil
}

func (s *Service) GetClub(ctx context.Context, id string) (*domain.Club, error) {
	c, err := s.store.GetClub(ctx, id, s.seasonIDPtr(ctx))
	return c, s.wrap(err, "Club")
}

// CreateClub registers a club, and optionally puts it in a division and gives it a manager.
func (s *Service) CreateClub(ctx context.Context, in ClubInput) (*domain.Club, error) {
	v, err := validateClub(in)
	if err != nil {
		return nil, err
	}
	var id string
	err = s.store.InTx(ctx, func(tx *store.Store) error {
		id, err = tx.CreateClub(ctx, v, slugify(v.Name))
		if err != nil {
			return err
		}
		if in.ManagerEmail != "" {
			if err := s.assignManager(ctx, tx, id, in.ManagerEmail); err != nil {
				return err
			}
		}
		if in.DivisionID != "" {
			d, err := tx.GetDivision(ctx, in.DivisionID)
			if err != nil {
				return badRequest("The chosen division doesn't exist.")
			}
			total, _, err := tx.CountMatches(ctx, d.ID, domain.StageLeague)
			if err != nil {
				return err
			}
			if total > 0 {
				return conflict("%s already has fixtures, so a new club can't join it.", d.Name)
			}
			return tx.SetDivisionClubs(ctx, d.ID, d.SeasonID, append(append([]string(nil), d.ClubIDs...), id))
		}
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Club")
	}
	return s.GetClub(ctx, id)
}

func (s *Service) UpdateClub(ctx context.Context, id string, in ClubInput) (*domain.Club, error) {
	v, err := validateClub(in)
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdateClub(ctx, id, v); err != nil {
		return nil, s.wrap(err, "Club")
	}
	return s.GetClub(ctx, id)
}

// ArchiveClub hides a club that has history; DeleteClub removes one that never played.
func (s *Service) SetClubArchived(ctx context.Context, id string, archived bool) (*domain.Club, error) {
	status := "active"
	if archived {
		status = "archived"
	}
	if err := s.store.SetClubStatus(ctx, id, status); err != nil {
		return nil, s.wrap(err, "Club")
	}
	return s.GetClub(ctx, id)
}

func (s *Service) DeleteClub(ctx context.Context, id string) error {
	return s.wrap(s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockClubForDelete(ctx, id); err != nil {
			return err
		}
		has, err := tx.ClubHasAnyMatch(ctx, id)
		if err != nil {
			return err
		}
		if has {
			return conflict("This club has fixtures or results. Archive it instead of deleting it.")
		}
		roster, err := tx.Roster(ctx, id)
		if err != nil {
			return err
		}
		if len(roster) > 0 {
			return conflict("Release the club's players before deleting it.")
		}
		return tx.DeleteClub(ctx, id)
	}), "Club")
}

// assignManager links a club to the account with this email; "" clears it.
func (s *Service) assignManager(ctx context.Context, tx *store.Store, clubID, email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return tx.SetClubManager(ctx, clubID, nil)
	}
	u, err := tx.FindUserByEmail(ctx, email)
	if err != nil {
		return badRequest("No account uses %s. Ask them to sign up first.", email)
	}
	return tx.SetClubManager(ctx, clubID, &u.ID)
}

// SetClubManager gives a club a manager by email, or removes it with "".
func (s *Service) SetClubManager(ctx context.Context, clubID, email string) (*domain.Club, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if _, err := tx.GetClub(ctx, clubID, nil); err != nil {
			return err
		}
		return s.assignManager(ctx, tx, clubID, email)
	})
	if err != nil {
		return nil, s.wrap(err, "Club")
	}
	return s.GetClub(ctx, clubID)
}

// ---- players ---------------------------------------------------------------

type PlayerInput struct {
	Gamertag        string `json:"gamertag"`
	EAID            string `json:"ea_id"`
	Platform        string `json:"platform"`
	PrimaryPosition string `json:"primary_position"`
	AvatarURL       string `json:"avatar_url"`
	// The next fields are for admins creating a player.
	UserEmail string `json:"user_email"`
	ClubID    string `json:"club_id"`
	Shirt     int    `json:"shirt_number"`
	SquadRole string `json:"squad_role"`
}

func validatePlayer(in PlayerInput) (store.PlayerInput, error) {
	tag := cleanText(in.Gamertag)
	if len(tag) < 2 || len(tag) > 32 {
		return store.PlayerInput{}, badRequest("A gamertag needs 2 to 32 characters.")
	}
	platform := strings.ToUpper(cleanText(in.Platform))
	if platform == "" {
		platform = "PS"
	}
	if !domain.ValidPlatform(platform) {
		return store.PlayerInput{}, badRequest("Platform must be PS, XBOX or PC.")
	}
	pos := strings.ToUpper(cleanText(in.PrimaryPosition))
	if !domain.ValidPosition(pos) {
		return store.PlayerInput{}, badRequest("Choose a valid position.")
	}
	if len(cleanText(in.EAID)) > 40 {
		return store.PlayerInput{}, badRequest("The EA ID is too long.")
	}
	avatar := cleanText(in.AvatarURL)
	if !validCrestURL(avatar) {
		return store.PlayerInput{}, badRequest("The picture must be an image link starting with https://.")
	}
	return store.PlayerInput{Gamertag: tag, EAID: cleanText(in.EAID), Platform: platform, PrimaryPosition: pos, AvatarURL: avatar}, nil
}

func (s *Service) ListPlayers(ctx context.Context, f store.PlayerFilter) ([]domain.Player, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 100
	}
	out, err := s.store.ListPlayers(ctx, f)
	return out, s.wrap(err, "players")
}

func (s *Service) GetPlayer(ctx context.Context, id string) (*domain.Player, error) {
	p, err := s.store.GetPlayer(ctx, id)
	return p, s.wrap(err, "Player")
}

// CreatePlayer is the admin way to add a player, optionally linked to an account
// and registered to a club in one step.
func (s *Service) CreatePlayer(ctx context.Context, in PlayerInput) (*domain.Player, error) {
	v, err := validatePlayer(in)
	if err != nil {
		return nil, err
	}
	var id string
	err = s.store.InTx(ctx, func(tx *store.Store) error {
		if in.UserEmail != "" {
			u, err := tx.FindUserByEmail(ctx, in.UserEmail)
			if err != nil {
				return badRequest("No account uses %s.", in.UserEmail)
			}
			v.UserID = &u.ID
		}
		id, err = tx.CreatePlayer(ctx, v)
		if err != nil {
			return err
		}
		if in.ClubID != "" {
			return s.registerPlayer(ctx, tx, id, in.ClubID, in.Shirt, in.SquadRole, nil)
		}
		return nil
	})
	if err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, id)
}

func (s *Service) UpdatePlayer(ctx context.Context, id string, in PlayerInput) (*domain.Player, error) {
	v, err := validatePlayer(in)
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdatePlayer(ctx, id, v); err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, id)
}

// LinkPlayerUser connects a player to an account by email; "" disconnects.
func (s *Service) LinkPlayerUser(ctx context.Context, id, email string) (*domain.Player, error) {
	email = strings.TrimSpace(email)
	var userID *string
	if email != "" {
		u, err := s.store.FindUserByEmail(ctx, email)
		if err != nil {
			return nil, badRequest("No account uses %s.", email)
		}
		userID = &u.ID
	}
	if err := s.store.SetPlayerUser(ctx, id, userID); err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, id)
}

func (s *Service) DeletePlayer(ctx context.Context, id string) error {
	return s.wrap(s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockPlayer(ctx, id); err != nil {
			return err
		}
		has, err := tx.PlayerHasHistory(ctx, id)
		if err != nil {
			return err
		}
		if has {
			return conflict("This player has recorded stats or a signed contract, so they can't be deleted.")
		}
		return tx.DeletePlayer(ctx, id)
	}), "Player")
}

// registerPlayer puts a free agent on a club's squad. Shirt 0 means "first free".
func (s *Service) registerPlayer(ctx context.Context, tx *store.Store, playerID, clubID string, shirt int, role string, contractID *string) error {
	season, err := tx.CurrentSeason(ctx)
	if err != nil {
		return badRequest("There is no season yet. Create one first.")
	}
	if season.Status == domain.SeasonCompleted {
		return badRequest("The latest season is completed. Start a new season first.")
	}
	club, err := tx.GetClub(ctx, clubID, &season.ID)
	if err != nil {
		return badRequest("That club doesn't exist.")
	}
	if club.Status != "active" {
		return badRequest("%s is archived.", club.Name)
	}
	if role == "" {
		role = domain.RoleFirstTeam
	}
	if !domain.ValidSquadRole(role) {
		return badRequest("Choose First team, Rotation or Reserve.")
	}
	if err := tx.LockPlayer(ctx, playerID); err != nil {
		return err
	}
	if _, err := tx.OpenRegistration(ctx, playerID); err == nil {
		return conflict("This player is already registered to a club. Release them first.")
	}
	taken, err := tx.TakenShirts(ctx, clubID)
	if err != nil {
		return err
	}
	if shirt != 0 && (shirt < 1 || shirt > 99) {
		return badRequest("Shirt numbers run from 1 to 99.")
	}
	if shirt != 0 && taken[shirt] {
		return conflict("Shirt %d is already taken at %s.", shirt, club.Name)
	}
	n := domain.PickShirtNumber(shirt, taken)
	if n == 0 {
		return conflict("%s has no free shirt numbers.", club.Name)
	}
	return tx.CreateRegistration(ctx, playerID, clubID, season.ID, n, role, contractID)
}

// RegisterPlayer is the admin way to put a free agent on a club without a contract.
func (s *Service) RegisterPlayer(ctx context.Context, playerID, clubID string, shirt int, role string) (*domain.Player, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		return s.registerPlayer(ctx, tx, playerID, clubID, shirt, role, nil)
	})
	if err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, playerID)
}

// ReleasePlayer takes a player off their club's squad (admin), pulling them out of
// any team sheet that hasn't been played and sending those sheets back to draft.
func (s *Service) ReleasePlayer(ctx context.Context, playerID string) (*domain.Player, error) {
	err := s.store.InTx(ctx, func(tx *store.Store) error {
		if err := tx.LockPlayer(ctx, playerID); err != nil {
			return err
		}
		reg, err := tx.OpenRegistration(ctx, playerID)
		if err != nil {
			return conflict("This player isn't on a club's squad.")
		}
		if err := tx.EndRegistration(ctx, playerID); err != nil {
			return err
		}
		return s.afterPlayerLeaves(ctx, tx, reg.ClubID, playerID, "A player was released; review this team sheet.")
	})
	if err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, playerID)
}

// afterPlayerLeaves fixes the old club's unplayed team sheets: submitted ones that
// named the player go back to draft, and the player is removed from all of them.
func (s *Service) afterPlayerLeaves(ctx context.Context, tx *store.Store, clubID, playerID, reason string) error {
	if _, err := tx.ReopenSheets(ctx, clubID, playerID, reason); err != nil {
		return err
	}
	return tx.DropPlayerFromSheets(ctx, clubID, playerID)
}

// ---- a signed-in user's own player profile ----------------------------------

// MyPlayerInput is what a person fills in about themselves.
type MyPlayerInput struct {
	Gamertag        string `json:"gamertag"`
	EAID            string `json:"ea_id"`
	Platform        string `json:"platform"`
	PrimaryPosition string `json:"primary_position"`
}

// CreateMyPlayer makes the caller's own player profile, as a free agent.
func (s *Service) CreateMyPlayer(ctx context.Context, userID string, in MyPlayerInput) (*domain.Player, error) {
	v, err := validatePlayer(PlayerInput{Gamertag: in.Gamertag, EAID: in.EAID, Platform: in.Platform, PrimaryPosition: in.PrimaryPosition})
	if err != nil {
		return nil, err
	}
	v.UserID = &userID
	id, err := s.store.CreatePlayer(ctx, v)
	if err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, id)
}

// UpdateMyPlayer edits the caller's own profile.
func (s *Service) UpdateMyPlayer(ctx context.Context, userID string, in MyPlayerInput) (*domain.Player, error) {
	p, err := s.store.GetPlayerByUser(ctx, userID)
	if err != nil {
		return nil, s.wrap(err, "Player profile")
	}
	v, err := validatePlayer(PlayerInput{Gamertag: in.Gamertag, EAID: in.EAID, Platform: in.Platform, PrimaryPosition: in.PrimaryPosition, AvatarURL: p.AvatarURL})
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdatePlayer(ctx, p.ID, v); err != nil {
		return nil, s.wrap(err, "Player")
	}
	return s.GetPlayer(ctx, p.ID)
}

// MyPlayer is the caller's player profile, or nil if they haven't made one.
func (s *Service) MyPlayer(ctx context.Context, userID string) (*domain.Player, error) {
	p, err := s.store.GetPlayerByUser(ctx, userID)
	if err == store.ErrNotFound {
		return nil, nil
	}
	return p, s.wrap(err, "Player")
}
