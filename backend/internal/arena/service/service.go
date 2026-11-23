// Package service is Clubs Arena's business logic: the rules for seasons, clubs,
// results, transfers and team sheets, on top of the store and the pure rules in
// the domain package.
package service

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
)

// Error is a failure the caller can show to the user, with the HTTP status it
// should be sent with.
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return e.Message }

func badRequest(format string, a ...any) *Error {
	return &Error{http.StatusBadRequest, fmt.Sprintf(format, a...)}
}
func notFoundErr(what string) *Error {
	return &Error{http.StatusNotFound, what + " not found"}
}
func conflict(format string, a ...any) *Error {
	return &Error{http.StatusConflict, fmt.Sprintf(format, a...)}
}
func forbidden(format string, a ...any) *Error {
	return &Error{http.StatusForbidden, fmt.Sprintf(format, a...)}
}

// Mailer sends an email. It is satisfied by Showtime's email service.
type Mailer interface {
	SendEmail(to, subject, htmlBody string) error
}

// Service holds the dependencies every operation shares.
type Service struct {
	store *store.Store
	mail  Mailer
	// frontendURL is the Arena site's address, used in email links.
	frontendURL string
	now         func() time.Time
}

// New builds the service. mail may be nil, in which case no emails are sent.
func New(st *store.Store, mail Mailer, frontendURL string) *Service {
	return &Service{store: st, mail: mail, frontendURL: strings.TrimRight(frontendURL, "/"), now: time.Now}
}

// today is the current calendar date in Lagos.
func (s *Service) today() time.Time {
	n := s.now().In(domain.Lagos)
	return time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
}

// wrap turns store errors the caller can't act on into a 500, and the known
// constraint violations into friendly 4xx errors.
func (s *Service) wrap(err error, what string) error {
	if err == nil {
		return nil
	}
	var se *Error
	if errors.As(err, &se) {
		return err
	}
	if errors.Is(err, store.ErrNotFound) {
		return notFoundErr(what)
	}
	if name, ok := store.IsUniqueViolation(err); ok {
		switch name {
		case "idx_arena_clubs_name":
			return conflict("A club with that name already exists.")
		case "idx_arena_clubs_short":
			return conflict("That abbreviation is already used by another club.")
		case "idx_arena_clubs_manager":
			return conflict("That person already manages another club.")
		case "idx_arena_players_gamertag":
			return conflict("That gamertag is already registered.")
		case "arena_players_user_id_key":
			return conflict("That account is already linked to a player.")
		case "idx_arena_divisions_name":
			return conflict("This season already has a division with that name.")
		case "arena_seasons_number_key":
			return conflict("There is already a season with that number.")
		case "idx_arena_seasons_one_live":
			return conflict("Another season is already live. Finish it before starting this one.")
		case "idx_arena_reg_shirt_open":
			return conflict("That shirt number is already taken at this club.")
		case "idx_arena_reg_player_open":
			return conflict("This player is already registered to a club.")
		case "idx_arena_contracts_open":
			return conflict("There is already an open offer from this club to this player.")
		}
		return conflict("That already exists.")
	}
	log.Printf("arena: %s: %v", what, err)
	return &Error{http.StatusInternalServerError, "Something went wrong. Please try again."}
}

// ---- validation helpers ----------------------------------------------------

var (
	colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	shortRe = regexp.MustCompile(`^[A-Z0-9]{2,3}$`)
	slugRe  = regexp.MustCompile(`[^a-z0-9]+`)
)

func cleanText(s string) string { return strings.TrimSpace(s) }

// slugify makes a url-safe lower-case name.
func slugify(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(name) {
		if r > unicode.MaxASCII {
			continue
		}
		b.WriteRune(r)
	}
	s := strings.Trim(slugRe.ReplaceAllString(b.String(), "-"), "-")
	if s == "" {
		s = "club"
	}
	return s
}

func parseDate(s string) (*string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return nil, badRequest("Dates must look like 2026-10-12.")
	}
	return &s, nil
}

// validCrestURL accepts empty or an http(s) address.
func validCrestURL(u string) bool {
	if u == "" {
		return true
	}
	return (strings.HasPrefix(u, "https://") || strings.HasPrefix(u, "http://")) && len(u) <= 500
}

// ---- email -----------------------------------------------------------------

// send emails someone without ever failing the request that triggered it.
func (s *Service) send(to, subject, heading, body, linkPath, linkLabel string) {
	if s.mail == nil || to == "" {
		return
	}
	link := ""
	if s.frontendURL != "" && linkPath != "" {
		link = fmt.Sprintf(`<p style="margin:24px 0"><a href="%s%s" style="background:#111923;color:#d3f36a;padding:12px 20px;text-decoration:none;font-weight:600">%s</a></p>`,
			html.EscapeString(s.frontendURL), html.EscapeString(linkPath), html.EscapeString(linkLabel))
	}
	page := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#172126">
<h2 style="margin:0 0 12px">%s</h2><p style="line-height:1.5">%s</p>%s
<p style="color:#81878b;font-size:12px">Clubs Arena</p></div>`,
		html.EscapeString(heading), body, link)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("arena: email panic: %v", r)
			}
		}()
		if err := s.mail.SendEmail(to, subject, page); err != nil {
			log.Printf("arena: email to %s failed: %v", to, err)
		}
	}()
}

// esc escapes a user-supplied value for use inside an email body.
func esc(v string) string { return html.EscapeString(v) }

// currentSeason is the season the product is working in, or a friendly error.
func (s *Service) currentSeason(ctx context.Context) (*domain.Season, error) {
	season, err := s.store.CurrentSeason(ctx)
	if errors.Is(err, store.ErrNotFound) {
		return nil, badRequest("There is no season yet. Create one first.")
	}
	if err != nil {
		return nil, s.wrap(err, "season")
	}
	return season, nil
}
