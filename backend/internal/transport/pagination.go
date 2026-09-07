package transport

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Every list endpoint answers the same two questions — which page, and how big
// — and replies in the same shape. Keeping that in one place stops twenty
// handlers drifting apart on defaults, caps, or the names of the fields.

// MaxPageLimit is the most rows any endpoint will return in one request, no
// matter what the caller asks for. It is the backstop that makes "paginated"
// mean something: without it a client could request the whole table.
const MaxPageLimit = 200

// pageParams reads ?page= and ?limit=, falling back to the endpoint's own
// default. Junk values fall back rather than erroring — a bad page number is
// not worth failing a read over.
func pageParams(c *gin.Context, defaultLimit int) (page, limit int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit)))
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > MaxPageLimit {
		limit = MaxPageLimit
	}
	return page, limit
}

// pagedJSON writes the list envelope every paginated endpoint shares.
func pagedJSON(c *gin.Context, data any, total, page, limit int) {
	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"data":        data,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}
