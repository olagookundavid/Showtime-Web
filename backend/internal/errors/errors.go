package appErrors

import (
	"errors"
	"fmt"
)

var ErrDuplicateEmail = fmt.Errorf("duplicate email, please use another email")
var ErrNoUserRecordExist = fmt.Errorf("incorrect email or password") // General catch-all
var ErrAccountNotFound = fmt.Errorf("account not found")
var ErrIncorrectPassword = fmt.Errorf("incorrect password")
var ErrNoAuthHeader = fmt.Errorf("authorization header is not provided")
var ErrMustResetPassword = errors.New("MUST_RESET_PASSWORD")

var ErrWrongAuthFormat = fmt.Errorf("authorization header format is wrong")
var ErrPasswordDontMatch = fmt.Errorf("confirm password and new password don't match")
var ErrOldPasswordProvidedNotValid = fmt.Errorf("old password provided don't match")
var ErrInvalidEmailType = fmt.Errorf("the provided string isn't an email")

var ErrServerError = fmt.Errorf("something went wrong")

var ErrNotFound = errors.New("not found")

// ErrPlayerNotLinked distinguishes "this account has no player record behind it"
// from "this player simply has no contracts yet". Both used to surface as an
// empty list, which left a player staring at a blank portal with nothing telling
// them their claim still needs approving.
var ErrPlayerNotLinked = errors.New("this account isn't linked to a player profile yet")

// Store-domain errors surfaced to the HTTP layer as 4xx
var ErrInsufficientStock = errors.New("insufficient stock")
var ErrVariantRequired = errors.New("variant selection required for this product")
var ErrVariantNotFound = errors.New("variant not found on product")

// Discount-code errors. Each is worded as the buyer should see it, because the
// checkout surfaces them verbatim — a code that silently does nothing is worse
// than one that says why it did nothing.
var (
	ErrDiscountNotFound      = errors.New("this code isn't valid")
	ErrDiscountInactive      = errors.New("this code is no longer active")
	ErrDiscountExpired       = errors.New("this code has expired")
	ErrDiscountExhausted     = errors.New("this code has already been fully used")
	ErrDiscountNotApplicable = errors.New("this code doesn't apply to anything in your order")
	ErrDiscountMembersOnly   = errors.New("this code is for signed-in customers only")
	ErrDiscountGuestsOnly    = errors.New("this code is for new guest checkouts only")
	ErrDuplicateDiscountCode = errors.New("a discount code with that name already exists")
)

var (
	ErrExampleNotFound  = errors.New("example not found")
	ErrDuplicateExample = errors.New("example already exists")
)
