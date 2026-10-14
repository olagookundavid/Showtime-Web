package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
)

// fakeRoleRepo is an in-memory roles table that counts how often the cache's
// source query runs.
type fakeRoleRepo struct {
	roles  map[string]*domain.Role
	loads  int
	failOn bool
	// onLoad runs in the middle of a load, to simulate a write racing it.
	onLoad func()
}

func newFakeRoleRepo() *fakeRoleRepo {
	return &fakeRoleRepo{roles: map[string]*domain.Role{
		"fantasy_editor": {Key: "fantasy_editor", Name: "Fantasy Editor", Permissions: map[string]domain.AccessLevel{domain.FeatureFantasy: domain.AccessFull}},
		"viewer":         {Key: "viewer", Name: "Viewer", Permissions: map[string]domain.AccessLevel{domain.FeatureNews: domain.AccessView}},
		"seller":         {Key: "seller", Name: "Seller", IsSystem: true, Permissions: map[string]domain.AccessLevel{domain.FeatureSellerTools: domain.AccessFull}},
		"user":           {Key: "user", Name: "User", IsSystem: true, Permissions: map[string]domain.AccessLevel{}},
	}}
}

func (f *fakeRoleRepo) LoadAllPermissions(context.Context) (map[string]map[string]domain.AccessLevel, error) {
	f.loads++
	if f.onLoad != nil {
		f.onLoad()
	}
	if f.failOn {
		return nil, errors.New("db down")
	}
	out := map[string]map[string]domain.AccessLevel{}
	for k, r := range f.roles {
		cp := map[string]domain.AccessLevel{}
		for feat, lvl := range r.Permissions {
			cp[feat] = lvl
		}
		out[k] = cp
	}
	return out, nil
}

func (f *fakeRoleRepo) LoadRoleNames(context.Context) (map[string]string, error) {
	out := map[string]string{}
	for k, r := range f.roles {
		out[k] = r.Name
	}
	return out, nil
}

func (f *fakeRoleRepo) ListRoles(context.Context) ([]domain.Role, error) {
	var out []domain.Role
	for _, r := range f.roles {
		out = append(out, *r)
	}
	return out, nil
}

func (f *fakeRoleRepo) GetRole(_ context.Context, key string) (*domain.Role, error) {
	r, ok := f.roles[key]
	if !ok {
		return nil, appErrors.ErrRoleNotFound
	}
	cp := *r
	return &cp, nil
}

func (f *fakeRoleRepo) RoleExists(_ context.Context, key string) (bool, error) {
	_, ok := f.roles[key]
	return ok, nil
}

func (f *fakeRoleRepo) CreateRole(_ context.Context, r domain.Role) error {
	f.roles[r.Key] = &r
	return nil
}

func (f *fakeRoleRepo) UpdateRole(_ context.Context, r domain.Role) error {
	old := f.roles[r.Key]
	r.IsSystem = old.IsSystem
	f.roles[r.Key] = &r
	return nil
}

func (f *fakeRoleRepo) DeleteRole(_ context.Context, key string) error {
	delete(f.roles, key)
	return nil
}

func (f *fakeRoleRepo) RolesWithFullAccess(context.Context, string) ([]string, error) {
	return nil, nil
}

// fakeAuthRepo only answers the one question the role service asks it.
type fakeAuthRepo struct {
	ports.IAuthRepository
	roles map[string]string
}

func (f *fakeAuthRepo) GetUserRole(_ context.Context, id string) (string, error) {
	r, ok := f.roles[id]
	if !ok {
		return "", appErrors.ErrNoUserRecordExist
	}
	return r, nil
}

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func newTestRoleService() (*RoleService, *fakeRoleRepo, *clock) {
	repo := newFakeRoleRepo()
	auth := &fakeAuthRepo{roles: map[string]string{
		"u-editor": "fantasy_editor",
		"u-viewer": "viewer",
		"u-super":  domain.RoleAppAdmin,
		"u-seller": "seller",
		"u-plain":  "user",
	}}
	svc := NewRoleService(repo, auth)
	clk := &clock{t: time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)}
	svc.now = clk.now
	return svc, repo, clk
}

func TestAccessLevelsComeFromTheRole(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()

	a, err := svc.ResolveUser(ctx, "u-editor")
	if err != nil {
		t.Fatal(err)
	}
	if got := a.Level(domain.FeatureFantasy); got != domain.AccessFull {
		t.Errorf("editor fantasy = %q, want full", got)
	}
	if got := a.Level(domain.FeatureNews); got != domain.AccessNone {
		t.Errorf("editor news = %q, want none", got)
	}
	if a.RoleName != "Fantasy Editor" {
		t.Errorf("role name = %q", a.RoleName)
	}

	s, _ := svc.ResolveUser(ctx, "u-super")
	for _, f := range domain.FeatureCatalog {
		if s.Level(f.Key) != domain.AccessFull {
			t.Errorf("app_admin should have full %s", f.Key)
		}
	}
}

func TestIsStaffIgnoresSellerPortal(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()

	cases := map[string]bool{"u-editor": true, "u-viewer": true, "u-super": true, "u-seller": false, "u-plain": false}
	for uid, want := range cases {
		a, err := svc.ResolveUser(ctx, uid)
		if err != nil {
			t.Fatal(err)
		}
		if a.IsStaff() != want {
			t.Errorf("%s IsStaff = %v, want %v", uid, a.IsStaff(), want)
		}
	}
}

func TestCacheIsReusedUntilTheTTLPasses(t *testing.T) {
	svc, repo, clk := newTestRoleService()
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		if _, err := svc.ResolveUser(ctx, "u-editor"); err != nil {
			t.Fatal(err)
		}
	}
	if repo.loads != 1 {
		t.Fatalf("5 requests inside the TTL did %d loads, want 1", repo.loads)
	}

	clk.t = clk.t.Add(29 * time.Minute)
	svc.ResolveUser(ctx, "u-editor")
	if repo.loads != 1 {
		t.Fatalf("at 29m the cache should still be fresh, loads = %d", repo.loads)
	}

	clk.t = clk.t.Add(2 * time.Minute)
	svc.ResolveUser(ctx, "u-editor")
	if repo.loads != 2 {
		t.Fatalf("past 30m the cache should reload, loads = %d", repo.loads)
	}
}

func TestAWriteInvalidatesTheCacheAtOnce(t *testing.T) {
	svc, repo, _ := newTestRoleService()
	ctx := context.Background()
	super := &Access{super: true}

	before, _ := svc.ResolveUser(ctx, "u-editor")
	if before.Level(domain.FeatureNews) != domain.AccessNone {
		t.Fatal("precondition: editor has no news access")
	}

	_, err := svc.UpdateRole(ctx, super, "fantasy_editor", RoleInput{
		Name: "Fantasy Editor",
		Permissions: map[string]domain.AccessLevel{
			domain.FeatureFantasy: domain.AccessView,
			domain.FeatureNews:    domain.AccessFull,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	after, _ := svc.ResolveUser(ctx, "u-editor")
	if after.Level(domain.FeatureNews) != domain.AccessFull || after.Level(domain.FeatureFantasy) != domain.AccessView {
		t.Errorf("edit not visible straight away: news=%q fantasy=%q",
			after.Level(domain.FeatureNews), after.Level(domain.FeatureFantasy))
	}
	if repo.loads != 2 {
		t.Errorf("loads = %d, want 2 (initial + after invalidation)", repo.loads)
	}
}

func TestStaleCopyServedWhenRefreshFails(t *testing.T) {
	svc, repo, clk := newTestRoleService()
	ctx := context.Background()

	svc.ResolveUser(ctx, "u-editor")
	clk.t = clk.t.Add(time.Hour)
	repo.failOn = true

	a, err := svc.ResolveUser(ctx, "u-editor")
	if err != nil {
		t.Fatalf("a DB failure should fall back to the expired copy: %v", err)
	}
	if a.Level(domain.FeatureFantasy) != domain.AccessFull {
		t.Error("stale copy lost the editor's access")
	}
}

func TestNoStaleFallbackAfterInvalidation(t *testing.T) {
	svc, repo, _ := newTestRoleService()
	ctx := context.Background()

	svc.ResolveUser(ctx, "u-editor")
	svc.invalidate()
	repo.failOn = true

	if _, err := svc.ResolveUser(ctx, "u-editor"); err == nil {
		t.Fatal("after a write there is no trustworthy copy; the request must fail, not serve old access")
	}
}

func TestLoadRacingAWriteDoesNotRepopulateStaleData(t *testing.T) {
	svc, repo, _ := newTestRoleService()
	ctx := context.Background()

	// A write lands while the cache is mid-reload.
	repo.onLoad = func() {
		repo.onLoad = nil
		svc.invalidate()
	}
	svc.ResolveUser(ctx, "u-editor")
	svc.ResolveUser(ctx, "u-editor")

	if repo.loads != 2 {
		t.Errorf("a load that raced a write must not be cached; loads = %d, want 2", repo.loads)
	}
}

func TestCannotGrantAccessYouDoNotHold(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()

	editor, _ := svc.ResolveUser(ctx, "u-editor") // fantasy: full only

	_, err := svc.CreateRole(ctx, editor, RoleInput{Name: "Sneaky", Permissions: map[string]domain.AccessLevel{domain.FeatureNews: domain.AccessFull}})
	if !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("granting news without holding it: err = %v, want escalation", err)
	}

	// Granting view of something you hold at full is fine.
	r, err := svc.CreateRole(ctx, editor, RoleInput{Name: "Fantasy Helper", Permissions: map[string]domain.AccessLevel{domain.FeatureFantasy: domain.AccessView}})
	if err != nil {
		t.Fatalf("creating a narrower role should work: %v", err)
	}
	if r.Key != "fantasy_helper" {
		t.Errorf("key = %q, want fantasy_helper", r.Key)
	}

	// view can't be turned into full.
	viewer, _ := svc.ResolveUser(ctx, "u-viewer")
	_, err = svc.CreateRole(ctx, viewer, RoleInput{Name: "News Boss", Permissions: map[string]domain.AccessLevel{domain.FeatureNews: domain.AccessFull}})
	if !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("view -> full: err = %v, want escalation", err)
	}
}

func TestCannotEditARoleStrongerThanYou(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()

	viewer, _ := svc.ResolveUser(ctx, "u-viewer")
	// fantasy_editor holds fantasy:full, which the viewer lacks, so the viewer must
	// not be able to rewrite (e.g. strip) it either.
	_, err := svc.UpdateRole(ctx, viewer, "fantasy_editor", RoleInput{Name: "Fantasy Editor"})
	if !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("err = %v, want escalation", err)
	}
	err = svc.DeleteRole(ctx, viewer, "fantasy_editor")
	if !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("delete: err = %v, want escalation", err)
	}
}

func TestOnlyAppAdminCanAssignAppAdmin(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()

	editor, _ := svc.ResolveUser(ctx, "u-editor")
	if err := svc.CheckCanAssign(ctx, editor, domain.RoleAppAdmin); !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("non-super assigning app_admin: err = %v", err)
	}
	super, _ := svc.ResolveUser(ctx, "u-super")
	if err := svc.CheckCanAssign(ctx, super, domain.RoleAppAdmin); err != nil {
		t.Errorf("app_admin assigning app_admin: err = %v", err)
	}
	if err := svc.CheckCanAssign(ctx, editor, "viewer"); !errors.Is(err, appErrors.ErrRoleEscalation) {
		t.Errorf("editor assigning a role with news access they lack: err = %v", err)
	}
	if err := svc.CheckCanAssign(ctx, editor, "user"); err != nil {
		t.Errorf("assigning a no-access role should be fine: %v", err)
	}
}

func TestSystemRolesAreReadOnly(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()
	super := &Access{super: true}

	if _, err := svc.UpdateRole(ctx, super, "seller", RoleInput{Name: "Seller"}); !errors.Is(err, appErrors.ErrSystemRole) {
		t.Errorf("update system role: err = %v", err)
	}
	if err := svc.DeleteRole(ctx, super, "seller"); !errors.Is(err, appErrors.ErrSystemRole) {
		t.Errorf("delete system role: err = %v", err)
	}
}

func TestRoleInputValidation(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()
	super := &Access{super: true}

	if _, err := svc.CreateRole(ctx, super, RoleInput{Name: "  "}); !errors.Is(err, appErrors.ErrInvalidRoleName) {
		t.Errorf("blank name: err = %v", err)
	}
	if _, err := svc.CreateRole(ctx, super, RoleInput{Name: "X", Permissions: map[string]domain.AccessLevel{"not_a_feature": domain.AccessFull}}); !errors.Is(err, appErrors.ErrInvalidFeature) {
		t.Errorf("unknown feature: err = %v", err)
	}

	// "none" entries are dropped, not stored.
	r, err := svc.CreateRole(ctx, super, RoleInput{Name: "Tidy", Permissions: map[string]domain.AccessLevel{
		domain.FeatureNews: domain.AccessNone, domain.FeatureFantasy: domain.AccessView,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Permissions) != 1 || r.Permissions[domain.FeatureFantasy] != domain.AccessView {
		t.Errorf("permissions = %v", r.Permissions)
	}
}

func TestKeyIsUniqueAndSlugged(t *testing.T) {
	svc, _, _ := newTestRoleService()
	ctx := context.Background()
	super := &Access{super: true}

	a, _ := svc.CreateRole(ctx, super, RoleInput{Name: "Match Day Crew!"})
	b, err := svc.CreateRole(ctx, super, RoleInput{Name: "match day crew"})
	if err != nil {
		t.Fatal(err)
	}
	if a.Key != "match_day_crew" || b.Key != "match_day_crew_2" {
		t.Errorf("keys = %q, %q", a.Key, b.Key)
	}
}
