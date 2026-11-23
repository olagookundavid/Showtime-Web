// Package arena is Clubs Arena, an EA FC Pro Clubs tournament product that runs
// inside the Showtime server but is otherwise self-contained: its own tables
// (arena_*), its own routes (/api/v1/arena) and its own permissions. Showtime
// only lends it accounts, roles, email and the web server.
package arena

import (
	"showtime-backend/internal/arena/service"
	"showtime-backend/internal/arena/store"
	"showtime-backend/internal/arena/transport"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Config is what the module needs from the environment.
type Config struct {
	// FrontendURL is the Arena site's address, used for links in emails. When it
	// is empty emails are sent without a button.
	FrontendURL string
}

// Module is Arena, ready to mount on the API.
type Module struct {
	handler *transport.Handler
}

// New builds the module. mail may be nil to send no email.
func New(pool *pgxpool.Pool, mail service.Mailer, cfg Config) *Module {
	svc := service.New(store.New(pool), mail, cfg.FrontendURL)
	return &Module{handler: transport.New(svc)}
}

// Register mounts Arena's routes under /arena on the API group.
func (m *Module) Register(v1 *gin.RouterGroup, auth gin.HandlerFunc, roles services.IRoleService) {
	m.handler.Register(v1, auth, roles)
}
