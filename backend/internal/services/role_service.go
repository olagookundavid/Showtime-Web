package services

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
)

// permissionCacheTTL is how long the role -> permissions table is trusted before
// it is re-read. Every write to the role system drops the cache immediately, so
// the TTL only matters for changes made outside this process.
const permissionCacheTTL = 30 * time.Minute

// Access is what one signed-in user may do, resolved once per request.
type Access struct {
	UserID string
	Role   string
	// RoleName is the role's display name; Role is its permanent key.
	RoleName string

	super bool
	perms map[string]domain.AccessLevel
}

// Level is the user's access to a feature. app_admin is the superuser and has
// full access to everything, including features added after it was last edited.
func (a *Access) Level(feature string) domain.AccessLevel {
	if a == nil {
		return domain.AccessNone
	}
	if a.super {
		return domain.AccessFull
	}
	return a.perms[feature]
}

// IsStaff reports whether the user can open the admin panel at all.
func (a *Access) IsStaff() bool {
	if a == nil {
		return false
	}
	if a.super {
		return true
	}
	for _, f := range domain.FeatureCatalog {
		if f.AdminPanel && a.perms[f.Key].Valid() {
			return true
		}
	}
	return false
}

// Permissions is the user's access as a plain map, for the profile response.
func (a *Access) Permissions() map[string]domain.AccessLevel {
	out := map[string]domain.AccessLevel{}
	if a == nil {
		return out
	}
	if a.super {
		for _, f := range domain.FeatureCatalog {
			out[f.Key] = domain.AccessFull
		}
		return out
	}
	for feature, level := range a.perms {
		if level.Valid() {
			out[feature] = level
		}
	}
	return out
}

// Covers reports whether the user holds at least every level in perms, which is
// what lets them hand that access to someone else.
func (a *Access) Covers(perms map[string]domain.AccessLevel) bool {
	for feature, level := range perms {
		if a.Level(feature).Rank() < level.Rank() {
			return false
		}
	}
	return true
}

// RoleInput is the editable part of a role.
type RoleInput struct {
	Name        string
	Description string
	Permissions map[string]domain.AccessLevel
}

// RoleOption is a role as offered in a dropdown.
type RoleOption struct {
	Key      string `json:"key"`
	Name     string `json:"name"`
	IsSystem bool   `json:"is_system"`
}

type IRoleService interface {
	// ResolveUser looks up a user's role and what that role may do.
	ResolveUser(ctx context.Context, userID string) (*Access, error)
	Features() []domain.FeatureDef
	ListRoles(ctx context.Context) ([]domain.Role, error)
	ListRoleOptions(ctx context.Context) ([]RoleOption, error)
	RoleExists(ctx context.Context, key string) (bool, error)
	CreateRole(ctx context.Context, actor *Access, in RoleInput) (*domain.Role, error)
	UpdateRole(ctx context.Context, actor *Access, key string, in RoleInput) (*domain.Role, error)
	DeleteRole(ctx context.Context, actor *Access, key string) error
	// CheckCanAssign reports whether actor may put someone into the role.
	CheckCanAssign(ctx context.Context, actor *Access, roleKey string) error
}

type RoleService struct {
	repo     ports.IRoleRepository
	authRepo ports.IAuthRepository
	ttl      time.Duration
	now      func() time.Time

	mu       sync.RWMutex
	snap     *roleSnapshot
	loadedAt time.Time
	// gen counts invalidations, so a load that began before a write can tell it
	// is stale and refuse to store itself over the newer state.
	gen uint64

	loadMu sync.Mutex // one reload at a time
}

// roleSnapshot is everything an access check needs, read together so the two
// halves can't disagree about which roles exist.
type roleSnapshot struct {
	perms map[string]map[string]domain.AccessLevel
	names map[string]string
}

func NewRoleService(repo ports.IRoleRepository, authRepo ports.IAuthRepository) *RoleService {
	return &RoleService{
		repo:     repo,
		authRepo: authRepo,
		ttl:      permissionCacheTTL,
		now:      time.Now,
	}
}

// invalidate drops the cache, so the next request re-reads the database. Called
// after every successful write to roles or their permissions.
func (s *RoleService) invalidate() {
	s.mu.Lock()
	s.snap = nil
	s.gen++
	s.mu.Unlock()
}

// snapshot returns the cached role table, loading it on first use and again
// once the TTL has passed. If a refresh fails while an expired copy is held,
// that copy is served: a database blip shouldn't lock the whole staff out.
// After an invalidation there is no copy to fall back on.
func (s *RoleService) snapshot(ctx context.Context) (*roleSnapshot, error) {
	if snap, ok := s.fresh(); ok {
		return snap, nil
	}

	s.loadMu.Lock()
	defer s.loadMu.Unlock()

	// Another request may have reloaded while this one waited its turn.
	if snap, ok := s.fresh(); ok {
		return snap, nil
	}

	s.mu.RLock()
	stale, gen := s.snap, s.gen
	s.mu.RUnlock()

	loaded, err := s.load(ctx)
	if err != nil {
		if stale != nil {
			return stale, nil
		}
		return nil, err
	}

	s.mu.Lock()
	if s.gen == gen {
		s.snap = loaded
		s.loadedAt = s.now()
	}
	s.mu.Unlock()
	return loaded, nil
}

func (s *RoleService) load(ctx context.Context) (*roleSnapshot, error) {
	perms, err := s.repo.LoadAllPermissions(ctx)
	if err != nil {
		return nil, err
	}
	names, err := s.repo.LoadRoleNames(ctx)
	if err != nil {
		return nil, err
	}
	return &roleSnapshot{perms: perms, names: names}, nil
}

func (s *RoleService) fresh() (*roleSnapshot, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.snap != nil && s.now().Sub(s.loadedAt) < s.ttl {
		return s.snap, true
	}
	return nil, false
}

func (s *RoleService) ResolveUser(ctx context.Context, userID string) (*Access, error) {
	role, err := s.authRepo.GetUserRole(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.accessForRole(ctx, userID, role)
}

func (s *RoleService) accessForRole(ctx context.Context, userID, role string) (*Access, error) {
	snap, err := s.snapshot(ctx)
	if err != nil {
		return nil, err
	}
	a := &Access{UserID: userID, Role: role, RoleName: snap.names[role], perms: snap.perms[role]}
	if a.RoleName == "" {
		a.RoleName = role
	}
	a.super = role == domain.RoleAppAdmin
	return a, nil
}

func (s *RoleService) Features() []domain.FeatureDef { return domain.FeatureCatalog }

func (s *RoleService) ListRoles(ctx context.Context) ([]domain.Role, error) {
	return s.repo.ListRoles(ctx)
}

func (s *RoleService) ListRoleOptions(ctx context.Context) ([]RoleOption, error) {
	roles, err := s.repo.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	opts := make([]RoleOption, 0, len(roles))
	for _, r := range roles {
		opts = append(opts, RoleOption{Key: r.Key, Name: r.Name, IsSystem: r.IsSystem})
	}
	return opts, nil
}

func (s *RoleService) RoleExists(ctx context.Context, key string) (bool, error) {
	return s.repo.RoleExists(ctx, key)
}

func (s *RoleService) CreateRole(ctx context.Context, actor *Access, in RoleInput) (*domain.Role, error) {
	role, err := s.build(in)
	if err != nil {
		return nil, err
	}
	if !actor.Covers(role.Permissions) {
		return nil, appErrors.ErrRoleEscalation
	}

	key, err := s.uniqueKey(ctx, role.Name)
	if err != nil {
		return nil, err
	}
	role.Key = key

	if err := s.repo.CreateRole(ctx, *role); err != nil {
		return nil, err
	}
	s.invalidate()
	return s.repo.GetRole(ctx, key)
}

func (s *RoleService) UpdateRole(ctx context.Context, actor *Access, key string, in RoleInput) (*domain.Role, error) {
	existing, err := s.repo.GetRole(ctx, key)
	if err != nil {
		return nil, err
	}
	if existing.IsSystem {
		return nil, appErrors.ErrSystemRole
	}

	role, err := s.build(in)
	if err != nil {
		return nil, err
	}
	// Editing replaces the whole permission set, so the editor has to be able to
	// grant what the role has now as well as what it is about to have: otherwise
	// an admin could strip a role they aren't trusted with.
	if !actor.Covers(role.Permissions) || !actor.Covers(existing.Permissions) {
		return nil, appErrors.ErrRoleEscalation
	}
	role.Key = key

	if err := s.repo.UpdateRole(ctx, *role); err != nil {
		return nil, err
	}
	s.invalidate()
	return s.repo.GetRole(ctx, key)
}

func (s *RoleService) DeleteRole(ctx context.Context, actor *Access, key string) error {
	existing, err := s.repo.GetRole(ctx, key)
	if err != nil {
		return err
	}
	if existing.IsSystem {
		return appErrors.ErrSystemRole
	}
	if !actor.Covers(existing.Permissions) {
		return appErrors.ErrRoleEscalation
	}
	if err := s.repo.DeleteRole(ctx, key); err != nil {
		return err
	}
	s.invalidate()
	return nil
}

func (s *RoleService) CheckCanAssign(ctx context.Context, actor *Access, roleKey string) error {
	if actor != nil && actor.super {
		return nil
	}
	if roleKey == domain.RoleAppAdmin {
		return appErrors.ErrRoleEscalation
	}
	snap, err := s.snapshot(ctx)
	if err != nil {
		return err
	}
	if !actor.Covers(snap.perms[roleKey]) {
		return appErrors.ErrRoleEscalation
	}
	return nil
}

// build validates the editable fields and drops "no access" entries.
func (s *RoleService) build(in RoleInput) (*domain.Role, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" || len(name) > 100 {
		return nil, appErrors.ErrInvalidRoleName
	}
	perms := map[string]domain.AccessLevel{}
	for feature, level := range in.Permissions {
		if _, ok := domain.FeatureByKey(feature); !ok {
			return nil, appErrors.ErrInvalidFeature
		}
		if level.Valid() {
			perms[feature] = level
		}
	}
	return &domain.Role{
		Name:        name,
		Description: strings.TrimSpace(in.Description),
		Permissions: perms,
	}, nil
}

var nonKeyChars = regexp.MustCompile(`[^a-z0-9]+`)

// uniqueKey turns a role name into a permanent slug, adding a number if the
// slug is taken. The key never changes after creation, even if the role is
// renamed, because users.role points at it.
func (s *RoleService) uniqueKey(ctx context.Context, name string) (string, error) {
	base := strings.Trim(nonKeyChars.ReplaceAllString(strings.ToLower(name), "_"), "_")
	if base == "" {
		return "", appErrors.ErrInvalidRoleName
	}
	if len(base) > 44 {
		base = strings.TrimRight(base[:44], "_")
	}
	key := base
	for i := 2; i < 100; i++ {
		exists, err := s.repo.RoleExists(ctx, key)
		if err != nil {
			return "", err
		}
		if !exists {
			return key, nil
		}
		key = base + "_" + strconv.Itoa(i)
	}
	return "", appErrors.ErrDuplicateRole
}

// NewTestAccess builds an Access with fixed permissions, for tests of code that
// consumes one (middleware, handlers) without a database behind it.
func NewTestAccess(userID, role string, perms map[string]domain.AccessLevel) *Access {
	return &Access{UserID: userID, Role: role, RoleName: role, perms: perms}
}

// NewTestSuperAccess is NewTestAccess for the app_admin superuser.
func NewTestSuperAccess(userID string) *Access {
	return &Access{UserID: userID, Role: domain.RoleAppAdmin, RoleName: "App Admin", super: true}
}
