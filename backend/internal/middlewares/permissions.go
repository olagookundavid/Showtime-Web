package middlewares

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// AccessContextKey holds the caller's resolved *services.Access. It is set by the
// first gate a request meets, so routes stacking several gates (matches, then
// play-by-play) resolve the user once.
const AccessContextKey = "access"

// AccessFrom returns the caller's access if a gate already resolved it.
func AccessFrom(c *gin.Context) *services.Access {
	if v, ok := c.Get(AccessContextKey); ok {
		if a, ok := v.(*services.Access); ok {
			return a
		}
	}
	return nil
}

// resolveAccess finds who is calling and what their role may do, answering 401
// itself when it can't. The result is also published under UserRoleContextKey
// for handlers that only need the role.
func resolveAccess(c *gin.Context, roleSvc services.IRoleService) (*services.Access, bool) {
	if a := AccessFrom(c); a != nil {
		return a, true
	}

	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "details": "missing token payload"})
		c.Abort()
		return nil, false
	}

	access, err := roleSvc.ResolveUser(c.Request.Context(), payload.UserId)
	if err != nil {
		// Only a missing account is a 401: the frontend signs people out on a 401,
		// and a database hiccup shouldn't do that to the whole staff.
		if errors.Is(err, appErrors.ErrNoUserRecordExist) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found", "details": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "couldn't check your access, please try again"})
		}
		c.Abort()
		return nil, false
	}

	c.Set(AccessContextKey, access)
	c.Set(UserRoleContextKey, access.Role)
	return access, true
}

// FeatureAccessMiddleware gates a route on one admin feature. What each role may
// do with a feature is data (the roles table), not code, so changing it never
// needs a deploy. It is method-aware: a role with view access may GET, and is
// refused on anything that changes state. app_admin passes every feature.
func FeatureAccessMiddleware(roleSvc services.IRoleService, featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		access, ok := resolveAccess(c, roleSvc)
		if !ok {
			return
		}

		switch access.Level(featureKey) {
		case domain.AccessFull:
			c.Next()
		case domain.AccessView:
			if c.Request.Method == http.MethodGet {
				c.Next()
				return
			}
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: view-only access",
				"details": "this role can view " + featureKey + " but not modify it",
			})
			c.Abort()
		default:
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: insufficient privileges",
				"details": "user does not have access to " + featureKey,
			})
			c.Abort()
		}
	}
}

// StaffOrRolesMiddleware lets in anyone who can open the admin panel, plus the
// listed fixed roles. It is for shared endpoints (file upload) that every staff
// member needs whichever feature they work in: the feature using the upload is
// gated separately.
func StaffOrRolesMiddleware(roleSvc services.IRoleService, fixedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		access, ok := resolveAccess(c, roleSvc)
		if !ok {
			return
		}
		if access.IsStaff() {
			c.Next()
			return
		}
		for _, r := range fixedRoles {
			if access.Role == r {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "forbidden: insufficient privileges",
			"details": "user does not have the required role to access this route",
		})
		c.Abort()
	}
}
