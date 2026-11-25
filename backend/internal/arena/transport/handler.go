// Package transport is Clubs Arena's HTTP layer: handlers that read the request,
// call the service, and write JSON. The rules live in the service package.
package transport

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"showtime-backend/internal/arena/service"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
)

// Handler serves every Arena endpoint.
type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler { return &Handler{svc: svc} }

// fail writes a service error with its own status, and anything unexpected as a
// 500 whose details stay in the log.
func fail(c *gin.Context, err error) {
	var se *service.Error
	if errors.As(err, &se) {
		c.JSON(se.Status, gin.H{"error": se.Message})
		return
	}
	log.Printf("arena: %s %s: %v", c.Request.Method, c.FullPath(), err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Something went wrong. Please try again."})
}

// reply writes data, or the error if there is one.
func reply(c *gin.Context, data any, err error) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

// replyCreated is reply with a 201.
func replyCreated(c *gin.Context, data any, err error) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

// done answers an action that returns nothing.
func done(c *gin.Context, err error) {
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// bind reads the JSON body, answering 400 itself when it can't.
func bind(c *gin.Context, v any) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "That request couldn't be read. Check the details and try again."})
		return false
	}
	return true
}

// userID is the signed-in user's id. Routes that call it sit behind the token
// middleware, so a failure here is answered as 401.
func userID(c *gin.Context) (string, bool) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Please sign in."})
		return "", false
	}
	return payload.UserId, true
}

func queryInt(c *gin.Context, key string) int {
	n, _ := strconv.Atoi(c.Query(key))
	return n
}
