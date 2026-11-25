package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"showtime-backend/internal/arena"
	"showtime-backend/internal/arena/testdb"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"pkg-common/commonAuth"
	"pkg-common/token"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type env struct {
	t      *testing.T
	router *gin.Engine
	maker  token.Maker
	pool   *pgxpool.Pool
}

func setup(t *testing.T) *env {
	pool := testdb.New(t)
	gin.SetMode(gin.TestMode)
	maker, err := token.NewPasetoMaker("12345678901234567890123456789012")
	if err != nil {
		t.Fatal(err)
	}
	roles := services.NewRoleService(ports.NewRoleRepository(pool), ports.NewAuthRepository(pool))
	r := gin.New()
	v1 := r.Group("/api/v1")
	arena.New(pool, nil, arena.Config{}).Register(v1, commonAuth.TokenMiddleware(maker), roles)
	return &env{t: t, router: r, maker: maker, pool: pool}
}

// user makes an account with a role and returns its id and a bearer token.
func (e *env) user(email, role string) (id, bearer string) {
	e.t.Helper()
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO users (full_name, email, role) VALUES ($1, $1, $2) RETURNING id::text`, email, role).Scan(&id)
	if err != nil {
		e.t.Fatal(err)
	}
	tok, _, err := e.maker.CreateToken(id, time.Hour)
	if err != nil {
		e.t.Fatal(err)
	}
	return id, tok
}

func (e *env) call(method, path, bearer string, body any) (int, map[string]any, []any) {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, "/api/v1/arena"+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	var obj map[string]any
	var arr []any
	raw := w.Body.Bytes()
	if len(raw) > 0 && raw[0] == '[' {
		_ = json.Unmarshal(raw, &arr)
	} else {
		_ = json.Unmarshal(raw, &obj)
	}
	return w.Code, obj, arr
}

func (e *env) expect(want int, method, path, bearer string, body any) map[string]any {
	e.t.Helper()
	code, obj, _ := e.call(method, path, bearer, body)
	if code != want {
		e.t.Fatalf("%s %s: status %d, want %d (%v)", method, path, code, want, obj)
	}
	return obj
}

func str(m map[string]any, k string) string { s, _ := m[k].(string); return s }

func TestHTTPPermissionsAndFlow(t *testing.T) {
	e := setup(t)
	// Roles are cached after the first request, so a custom role is made up front.
	if _, err := e.pool.Exec(context.Background(), `INSERT INTO roles (key, name) VALUES ('viewer', 'Viewer')`); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pool.Exec(context.Background(), `INSERT INTO role_permissions (role_key, feature, level) VALUES ('viewer', 'arena_clubs', 'view')`); err != nil {
		t.Fatal(err)
	}
	_, admin := e.user("admin@example.com", "arena_admin")
	_, fan := e.user("fan@example.com", "user")

	// Public reads work with no account, and an empty product says so politely.
	e.expect(404, "GET", "/overview", "", nil)
	e.expect(404, "GET", "/scope", "", nil)
	code, _, formations := e.call("GET", "/formations", "", nil)
	if code != 200 || len(formations) != 6 {
		t.Fatalf("formations: %d %d", code, len(formations))
	}

	// Staff routes need a login, and the right feature.
	e.expect(401, "POST", "/admin/seasons", "", map[string]any{"number": 1, "name": "S"})
	e.expect(403, "POST", "/admin/seasons", fan, map[string]any{"number": 1, "name": "S"})
	e.expect(403, "GET", "/admin/clubs", fan, nil)
	e.expect(401, "GET", "/me", "", nil)
	e.expect(400, "POST", "/admin/seasons", admin, map[string]any{"number": 0, "name": "S"})

	season := e.expect(201, "POST", "/admin/seasons", admin, map[string]any{"number": 4, "name": "Season 04", "ends_on": "2099-12-31"})
	sid := str(season, "id")
	div := e.expect(201, "POST", "/admin/seasons/"+sid+"/divisions", admin, map[string]any{
		"name": "Premier", "playoff_spots": 2, "kickoff_day": 0, "kickoff_slots": []string{"20:00"},
	})
	did := str(div, "id")

	_, mgrAToken := e.user("mgr-a@example.com", "user")
	_, mgrBToken := e.user("mgr-b@example.com", "user")
	clubA := e.expect(201, "POST", "/admin/clubs", admin, map[string]any{"name": "Alpha FC", "short": "AL", "division_id": did, "manager_email": "mgr-a@example.com"})
	clubB := e.expect(201, "POST", "/admin/clubs", admin, map[string]any{"name": "Bravo FC", "short": "BR", "division_id": did, "manager_email": "mgr-b@example.com"})
	e.expect(409, "POST", "/admin/clubs", admin, map[string]any{"name": "alpha fc", "short": "AX"})

	// Squads: 13 players each so team sheets can be built.
	pos := []string{"GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM"}
	var aPlayers []string
	for _, c := range []map[string]any{clubA, clubB} {
		for i, p := range pos {
			pl := e.expect(201, "POST", "/admin/players", admin, map[string]any{
				"gamertag": fmt.Sprintf("%s_%d", str(c, "short"), i), "primary_position": p, "club_id": str(c, "id"), "shirt_number": i + 1,
			})
			if str(c, "short") == "AL" {
				aPlayers = append(aPlayers, str(pl, "id"))
			}
		}
	}

	e.expect(201, "POST", "/admin/divisions/"+did+"/fixtures", admin, map[string]any{"first_date": time.Now().AddDate(0, 0, 3).Format("2006-01-02")})
	e.expect(409, "POST", "/admin/divisions/"+did+"/fixtures", admin, nil)
	e.expect(200, "POST", "/admin/seasons/"+sid+"/status", admin, map[string]any{"status": "active"})

	// Public pages now have data.
	scopeView := e.expect(200, "GET", "/scope", "", nil)
	if divs, _ := scopeView["divisions"].([]any); len(divs) != 1 {
		t.Fatalf("scope divisions: %v", scopeView["divisions"])
	}
	ov := e.expect(200, "GET", "/overview", "", nil)
	if m := ov["metrics"].(map[string]any); m["clubs"].(float64) != 2 {
		t.Fatalf("overview metrics: %v", m)
	}
	_, _, _ = e.call("GET", "/standings", "", nil)
	matches := e.expect(200, "GET", "/matches?state=upcoming", "", nil)
	list := matches["matches"].([]any)
	if len(list) != 2 {
		t.Fatalf("2 clubs in a double round robin play 2 matches, got %d", len(list))
	}
	first := list[0].(map[string]any)
	mid := str(first, "id")
	// Public pages must never carry anyone's contact details or account ids.
	for _, path := range []string{"/clubs", "/clubs/" + str(clubA, "slug"), "/overview", "/standings", "/matches?state=upcoming"} {
		_, obj, arr := e.call("GET", path, "", nil)
		raw, _ := json.Marshal(map[string]any{"o": obj, "a": arr})
		for _, banned := range []string{"@example.com", `"manager_email":"`, `"manager_user_id":"`, `"manager_name":"`} {
			if bytes.Contains(raw, []byte(banned)) {
				t.Fatalf("public %s leaks %q: %s", path, banned, raw)
			}
		}
	}
	e.expect(200, "GET", "/clubs/"+str(clubA, "slug"), "", nil)
	e.expect(404, "GET", "/clubs/nope", "", nil)

	// A public player profile hides the account link and EA ID; staff still see them.
	pub := e.expect(200, "GET", "/players/"+aPlayers[0], "", nil)["player"].(map[string]any)
	if pub["user_id"] != nil || str(pub, "ea_id") != "" {
		t.Fatalf("public player profile leaks account details: %v", pub)
	}
	if staff := e.expect(200, "GET", "/admin/players/"+aPlayers[0], admin, nil); staff["gamertag"] == nil {
		t.Fatalf("staff should still see the player: %v", staff)
	}

	// Results: the fan can't, staff can, and a wrong total is refused.
	e.expect(403, "PUT", "/admin/matches/"+mid+"/result", fan, map[string]any{"home_score": 1, "away_score": 0})
	e.expect(200, "GET", "/admin/matches/"+mid+"/result-form", admin, nil)
	e.expect(200, "PUT", "/admin/matches/"+mid+"/result", admin, map[string]any{"home_score": 1, "away_score": 0})
	e.expect(400, "PUT", "/admin/matches/"+mid+"/result", admin, map[string]any{"home_score": 150, "away_score": 0})
	e.expect(400, "PUT", "/admin/matches/"+mid+"/result", admin, map[string]any{
		"home_score": 2, "away_score": 0,
		"stats": []map[string]any{{"player_id": aPlayers[10], "club_id": str(first["home"].(map[string]any), "id"), "goals": 1}},
	})

	// A view-only role can read admin data but not change it.
	_, viewer := e.user("viewer@example.com", "viewer")
	e.expect(200, "GET", "/admin/clubs", viewer, nil)
	e.expect(403, "POST", "/admin/clubs", viewer, map[string]any{"name": "New", "short": "NW"})
	e.expect(403, "GET", "/admin/seasons", viewer, nil)

	// The signed-in user's own view.
	me := e.expect(200, "GET", "/me", mgrAToken, nil)
	if mc, _ := me["managed_club"].(map[string]any); str(mc, "id") != str(clubA, "id") {
		t.Fatalf("me.managed_club: %v", me["managed_club"])
	}
	e.expect(200, "PUT", "/me/follow", fan, map[string]any{"club_id": str(clubB, "id")})
	if got := str(e.expect(200, "GET", "/me", fan, nil), "followed_club_id"); got != str(clubB, "id") {
		t.Fatalf("followed club: %q", got)
	}
	e.expect(200, "DELETE", "/me/follow", fan, nil)
	e.expect(404, "PUT", "/me/follow", fan, map[string]any{"club_id": "00000000-0000-0000-0000-000000000000"})

	// Managers: only their own club's data, and fans have no club.
	e.expect(403, "GET", "/manage/contracts", fan, nil)
	e.expect(403, "GET", "/manage/club", fan, nil)
	e.expect(200, "GET", "/manage/club", mgrAToken, nil)
	// Staff with full club access can act for another club by id.
	e.expect(200, "GET", "/manage/club?club_id="+str(clubB, "id"), admin, nil)
	// A manager can't use the club_id override.
	if got := str(e.expect(200, "GET", "/manage/club?club_id="+str(clubB, "id"), mgrAToken, nil)["club"].(map[string]any), "id"); got != str(clubA, "id") {
		t.Fatalf("a manager must stay on their own club, got %s", got)
	}

	// Transfers over HTTP: a free agent signs for club A.
	pUserID, pToken := e.user("free@example.com", "user")
	_ = pUserID
	e.expect(201, "POST", "/me/player", pToken, map[string]any{"gamertag": "FreeBird", "platform": "PS", "primary_position": "ST"})
	e.expect(409, "POST", "/me/player", pToken, map[string]any{"gamertag": "Again", "primary_position": "ST"})
	e.expect(409, "POST", "/manage/contracts", mgrAToken, map[string]any{"player_id": aPlayers[0], "end_date": "2026-12-01", "terms": "x"}) // window closed
	e.expect(200, "POST", "/admin/seasons/"+sid+"/window", admin, map[string]any{"open": true})
	fa := e.expect(200, "GET", "/manage/players/search?q=FreeBird", mgrAToken, nil)
	_ = fa
	_, _, found := e.call("GET", "/manage/free-agents", mgrAToken, nil)
	if len(found) != 1 {
		t.Fatalf("free agents: %d", len(found))
	}
	freeID := str(found[0].(map[string]any), "id")
	offer := e.expect(201, "POST", "/manage/contracts", mgrAToken, map[string]any{
		"player_id": freeID, "squad_role": "first_team", "end_date": time.Now().AddDate(0, 0, 30).Format("2006-01-02"), "terms": "Welcome aboard.",
	})
	if str(offer, "status") != "awaiting_player" {
		t.Fatalf("offer: %v", offer)
	}
	oid := str(offer, "id")
	e.expect(403, "POST", "/me/contracts/"+oid+"/sign", fan, map[string]any{"signature": "FreeBird", "consent": true})
	e.expect(400, "POST", "/me/contracts/"+oid+"/sign", pToken, map[string]any{"signature": "nope", "consent": true})
	signed := e.expect(200, "POST", "/me/contracts/"+oid+"/sign", pToken, map[string]any{"signature": "freebird", "consent": true})
	if str(signed, "status") != "signed" {
		t.Fatalf("signed: %v", signed)
	}
	e.expect(200, "GET", "/me/contracts/"+oid, pToken, nil)
	e.expect(404, "GET", "/me/contracts/"+oid, fan, nil)

	// Team sheet over HTTP, and the other club can't use it.
	_, _, fixtures := e.call("GET", "/manage/fixtures", mgrAToken, nil)
	if len(fixtures) != 1 {
		t.Fatalf("manager fixtures: %d", len(fixtures))
	}
	matchID := str(fixtures[0].(map[string]any), "id")
	ed := e.expect(200, "GET", "/manage/teamsheets/"+matchID, mgrAToken, nil)
	sheet := ed["sheet"].(map[string]any)
	starters := map[string]string{}
	for _, s := range sheet["starters"].([]any) {
		sm := s.(map[string]any)
		starters[fmt.Sprintf("%d", int(sm["index"].(float64)))] = str(sm, "player_id")
	}
	save := map[string]any{"formation": str(sheet, "formation"), "starters": starters, "bench": sheet["bench"], "captain": str(sheet, "captain_player_id"), "submit": true}
	out := e.expect(200, "PUT", "/manage/teamsheets/"+matchID, mgrAToken, save)
	if str(out["sheet"].(map[string]any), "status") != "submitted" {
		t.Fatalf("sheet: %v", out["sheet"])
	}
	e.expect(403, "GET", "/manage/teamsheets/"+matchID, fan, nil)
	e.expect(200, "POST", "/manage/teamsheets/"+matchID+"/reopen", mgrAToken, nil)
	_ = mgrBToken
}
