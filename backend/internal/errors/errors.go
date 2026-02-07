package appErrors

import (
	"errors"
	"fmt"
)

var ErrDuplicateEmail = fmt.Errorf("duplicate email, please use another email")
var ErrNoUserRecordExist = fmt.Errorf("incorrect credentials")
var ErrNoAuthHeader = fmt.Errorf("authorization header is not provided")

var ErrWrongAuthFormat = fmt.Errorf("authorization header format is wrong")
var ErrPasswordDontMatch = fmt.Errorf("confirm password and new password don't match")
var ErrOldPasswordProvidedNotValid = fmt.Errorf("old password provided don't match")
var ErrInvalidEmailType = fmt.Errorf("the provided string isn't an email")

var ErrServerError = fmt.Errorf("something went wrong")

var ErrNotFound = errors.New("not found")

var (
	ErrExampleNotFound  = errors.New("example not found")
	ErrDuplicateExample = errors.New("example already exists")
)
