package services

import (
	"crypto/rand"
	"math/big"
	"strings"
)

// GenerateTicketCode creates a unique 8-character alphanumeric code prefixed with SFFL-
// expanding the space to 1.1 Trillion combinations.
// It excludes ambiguous characters like 0, O, I, 1 for better readability.
func GenerateTicketCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 8)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		code[i] = chars[n.Int64()]
	}
	return "SFFL-" + strings.ToUpper(string(code))
}

// GenerateReferralCode creates a unique 4-character alphanumeric code prefixed with SFFL-
// It excludes ambiguous characters like 0, O, I, 1 for better readability.
func GenerateReferralCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 4)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		code[i] = chars[n.Int64()]
	}
	return "SFFL-" + strings.ToUpper(string(code))
}

