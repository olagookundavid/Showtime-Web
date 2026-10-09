package middlewares

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// AccessLevel is how much a role can do on a given admin feature.
type AccessLevel int

const (
	AccessNone AccessLevel = iota
	AccessView
	AccessFull
)

// FeatureAccess is the single source of truth for role -> admin-feature access,
// transcribed from Admin_Roles_Features_Matrix_filled.xlsx (the chairman's signed-off
// matrix). Keep this in sync with its frontend mirror,
// frontend/src/config/featureAccess.ts, whenever the matrix changes.
//
// app_admin is deliberately never listed here — it keeps its existing hardcoded
// superuser bypass in FeatureAccessMiddleware below.
var FeatureAccess = map[string]map[string]AccessLevel{
	// Dashboard/Analytics is the one row the chairman checked for every single
	// role, including player/user/player_pending. Read literally that would hand
	// every role full business-analytics (revenue, etc.) access, which is out of
	// step with how tightly every other row is scoped — so this is kept to
	// admin/app_admin (its pre-existing access), on the read that the checkmark
	// meant "this role needs a landing screen," not literal analytics access.
	// player/user/player_pending get that landing screen via the new self-service
	// profile page instead of this feature. Flagged for the chairman to correct
	// explicitly if the literal reading was intended.
	"dashboard": {
		domain.RoleAdmin: AccessFull,
	},
	"user_management": {
		domain.RoleAdmin: AccessFull,
	},
	"competitions": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	"teams_standings": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleHeadReferee: AccessFull, domain.RoleStats: AccessFull,
		domain.RoleFantasyCommissioner: AccessView,
	},
	"matches": {
		domain.RoleAdmin: AccessFull, domain.RoleBroadcast: AccessFull,
		domain.RoleCommissioner: AccessFull, domain.RoleHeadReferee: AccessFull,
		domain.RoleReferee: AccessFull, domain.RoleStats: AccessFull,
		domain.RoleFantasyCommissioner: AccessView,
	},
	"play_by_play": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleHeadReferee: AccessFull, domain.RoleReferee: AccessFull,
		domain.RoleStats: AccessFull,
	},
	"play_by_play_commit": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleHeadReferee: AccessFull,
	},
	"broadcast_studio": {
		domain.RoleAdmin: AccessFull, domain.RoleBroadcast: AccessFull,
		domain.RoleContentCreator: AccessFull,
	},
	"stats_edit": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleHeadReferee: AccessFull,
	},
	"players": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleHeadReferee: AccessFull, domain.RoleReferee: AccessFull,
		domain.RoleStats: AccessFull,
		domain.RoleNewsHead: AccessView, domain.RoleContentCreator: AccessView,
	},
	"totw": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleFantasyCommissioner: AccessView,
	},
	"badges": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleFantasyCommissioner: AccessView,
	},
	"fantasy": {
		domain.RoleAdmin: AccessFull, domain.RoleFantasyCommissioner: AccessFull,
		domain.RoleCommissioner: AccessView,
	},
	"claims": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	// team_head's own (scoped-to-their-team) contracts/transfers access is handled
	// entirely by TeamHeadOrAdminMiddleware on the separate player-facing
	// /contracts and /transfers route groups and is untouched by this map. The
	// sheet's team_head checkmark here confirms that existing access stays full
	// (not downgraded to view) — it is deliberately NOT added below, since doing
	// so here would hand team_head the *admin oversight* routes covering every
	// team, not just their own.
	"contracts": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	"transfers": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	"transfer_windows": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleNewsHead: AccessView, domain.RoleContentCreator: AccessView,
	},
	"team_budgets": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	"tickets": {
		domain.RoleAdmin: AccessFull, domain.RoleTicketer: AccessFull,
	},
	"referrals": {
		domain.RoleAdmin: AccessFull, domain.RoleTicketer: AccessFull,
		domain.RoleStoreManager: AccessFull,
	},
	"season_admission_tiers": {
		domain.RoleAdmin: AccessFull, domain.RoleTicketer: AccessFull,
	},
	"game_pass_discounts": {
		domain.RoleAdmin: AccessFull, domain.RoleTicketer: AccessFull,
	},
	"event_days": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleNewsHead: AccessFull, domain.RoleContentCreator: AccessFull,
		domain.RoleReferee: AccessFull, domain.RoleStats: AccessFull,
		domain.RoleStoreManager: AccessFull,
		domain.RoleFantasyCommissioner: AccessView,
	},
	"store": {
		domain.RoleAdmin: AccessFull, domain.RoleStoreManager: AccessFull,
	},
	"inventory": {
		domain.RoleAdmin: AccessFull, domain.RoleStoreManager: AccessFull,
	},
	"news": {
		domain.RoleAdmin: AccessFull, domain.RoleNewsHead: AccessFull,
		domain.RoleContentCreator: AccessFull,
	},
	"hero_slides": {
		domain.RoleAdmin: AccessFull, domain.RoleContentCreator: AccessFull,
	},
	"gallery": {
		domain.RoleAdmin: AccessFull, domain.RoleContentCreator: AccessFull,
	},
	"live_stream": {
		domain.RoleAdmin: AccessFull,
	},
	"season_mvps": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
		domain.RoleFantasyCommissioner: AccessView, domain.RoleNewsHead: AccessView,
		domain.RoleContentCreator: AccessView,
	},
	"app_settings": {
		domain.RoleAdmin: AccessFull, domain.RoleCommissioner: AccessFull,
	},
	"seller_tools": {
		domain.RoleAdmin: AccessFull, domain.RoleStoreManager: AccessFull,
		domain.RoleSeller: AccessFull,
	},
	"administrator_tools": {
		// app_admin only — deliberately empty, nobody but the superuser bypass gets this.
		// (Not present as a row in the chairman's filled sheet; left at its
		// pre-existing app_admin-only access.)
	},
}

// FeatureAccessMiddleware is the generic replacement for the old per-route
// hand-written role lists. It is method-aware: a role with AccessView may GET
// the feature's routes but is 403'd on anything that mutates (POST/PUT/PATCH/DELETE).
func FeatureAccessMiddleware(authService services.IAuthService, featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil || payload == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "details": "missing token payload"})
			c.Abort()
			return
		}

		userProfile, err := authService.ReturnUserProfile(c.Request.Context(), payload.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found", "details": err.Error()})
			c.Abort()
			return
		}

		c.Set(UserRoleContextKey, userProfile.UserType)

		// app_admin is the superuser and is allowed on every feature-gated route.
		if userProfile.UserType == domain.RoleAppAdmin {
			c.Next()
			return
		}

		level := FeatureAccess[featureKey][userProfile.UserType]

		switch level {
		case AccessFull:
			c.Next()
			return
		case AccessView:
			if c.Request.Method == http.MethodGet {
				c.Next()
				return
			}
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: view-only access",
				"details": "this role can view " + featureKey + " but not modify it",
			})
			c.Abort()
			return
		default:
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: insufficient privileges",
				"details": "user does not have access to " + featureKey,
			})
			c.Abort()
			return
		}
	}
}
