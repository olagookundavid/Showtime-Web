package domain

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Roles that keep their own portal or flow in code. Every other role (admin,
// commissioner, content_creator...) is a row in the roles table whose access is
// edited from the admin panel, so nothing here names them.
const (
	RoleAppAdmin = "app_admin"
	RoleTeamHead = "team_head"
	RolePlayer   = "player"
	RoleSeller   = "seller"
	RoleUser     = "user"
)

type User struct {
	ID        string
	FullName  string
	Email     string
	Password  password
	Role      string
	Phone     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type password struct {
	Plaintext *string
	Hash      []byte
}

func (p *password) Set(plaintextPassword *string) error {
	if plaintextPassword == nil {
		p.Plaintext = nil
		p.Hash = nil
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(*plaintextPassword), 12)
	if err != nil {
		return err
	}
	p.Plaintext = plaintextPassword
	p.Hash = hash
	return nil
}

func (p *password) Matches(plaintextPassword string) (bool, error) {
	err := bcrypt.CompareHashAndPassword(p.Hash, []byte(plaintextPassword))
	if err != nil {
		switch {
		case errors.Is(err, bcrypt.ErrMismatchedHashAndPassword):
			return false, nil
		default:
			return false, err
		}
	}
	return true, nil
}

func IsValidPassword(str *string) bool {
	var hasNumber, hasSymbol bool
	if len(*str) < 8 {
		return false
	}
	for _, c := range *str {
		switch {
		case c >= '0' && c <= '9':
			hasNumber = true
		case strings.ContainsRune("!@#$%^&*()-_=+[]{}|;:,.<>/?", c):
			hasSymbol = true
		}
	}
	return hasNumber && hasSymbol
}

func IsValidEmail(str *string) error {
	if str == nil || len(*str) == 0 {
		return errors.New("email can't be empty")
	}
	_, err := mail.ParseAddress(*str)
	return err
}
