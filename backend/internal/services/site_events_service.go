package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"

	"github.com/google/uuid"
	"github.com/samber/go-batchify"
)

var ErrInvalidSiteEvent = errors.New("invalid analytics event")

// RequestMeta is what the server learns about a visitor from the HTTP request.
type RequestMeta struct {
	IP        string
	Country   string
	UserAgent string
}

type ISiteEventsService interface {
	Track(req dto.TrackEventRequest, meta RequestMeta) error
	RecordServerEvent(eventType, path string, meta RequestMeta)
	// Summary reports [from, to). With compare, it also reports the
	// same-length period just before, for "vs previous period" figures.
	// days is dto.SiteDaysAll, SiteDaysMatch or SiteDaysOther.
	Summary(ctx context.Context, from, to time.Time, days string, compare bool) (*dto.SiteTrafficSummary, error)
	// MatchDays lists every match day in [from, to) with its traffic, for
	// highlighting on the dashboard's calendar.
	MatchDays(ctx context.Context, from, to time.Time) ([]dto.SiteMatchDay, error)
	// Scope turns a date range and day filter into the scope raw-event
	// queries use, so the events list and export follow the same filter.
	Scope(ctx context.Context, from, to time.Time, days string) (ports.SiteScope, error)
	ListEvents(ctx context.Context, f ports.SiteEventFilter, page, limit int) (*dto.SiteEventsPage, error)
	ExportEventsCSV(ctx context.Context, f ports.SiteEventFilter, w io.Writer) error
	ExportSummaryCSV(ctx context.Context, from, to time.Time, days string, compare bool, w io.Writer) error
	// Close writes any events still waiting in the batch. Call on shutdown,
	// before the database pool closes.
	Close()
}

// Events are written in bulk, like audit logs: one COPY per 200 events or
// every 30 seconds, whichever comes first. The size cap also bounds how many
// worker-pool goroutines can be parked waiting on a batch at once.
const (
	siteEventsBatchSize     = 200
	siteEventsFlushInterval = 30 * time.Second
)

type SiteEventsService struct {
	repo    ports.ISiteEventsRepository
	batcher batchify.Batch[string, any]
	pending sync.Map
}

func NewSiteEventsService(repo ports.ISiteEventsRepository) *SiteEventsService {
	s := &SiteEventsService{repo: repo}
	s.batcher = batchify.NewBatchWithTimer(siteEventsBatchSize, s.flush, siteEventsFlushInterval)
	return s
}

var (
	sessionIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,64}$`)
	siteLocation     = loadSiteLocation()
)

// loadSiteLocation falls back to a fixed +01:00 offset (Nigeria has no DST) if
// the tz database isn't present, so day boundaries never silently become UTC.
func loadSiteLocation() *time.Location {
	if loc, err := time.LoadLocation("Africa/Lagos"); err == nil {
		return loc
	}
	return time.FixedZone("WAT", 3600)
}

func clip(s string, max int) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > max {
		return string(r[:max])
	}
	return s
}

// cleanPath keeps only the path: query strings and fragments can carry tokens
// (password resets, email verification) that must never reach the database.
func cleanPath(p string) string {
	p = strings.TrimSpace(p)
	if i := strings.IndexAny(p, "?#"); i >= 0 {
		p = p[:i]
	}
	if !strings.HasPrefix(p, "/") {
		return ""
	}
	return clip(p, 512)
}

func referrerHost(ref string) string {
	u, err := url.Parse(strings.TrimSpace(ref))
	if err != nil || u.Host == "" {
		return ""
	}
	return clip(strings.TrimPrefix(strings.ToLower(u.Hostname()), "www."), 255)
}

func cleanProperties(in map[string]any) map[string]any {
	if len(in) == 0 || len(in) > 20 {
		return nil
	}
	b, err := json.Marshal(in)
	if err != nil || len(b) > 2048 {
		return nil
	}
	return in
}

func (s *SiteEventsService) store(e *domain.SiteEvent, meta RequestMeta) {
	ua := parseUserAgent(meta.UserAgent)
	e.CreatedAt = time.Now().UTC()
	e.IP = clip(meta.IP, 45)
	e.Country = normalizeCountry(meta.Country)
	e.UserAgent = clip(meta.UserAgent, 512)
	e.DeviceType, e.Browser, e.OS, e.IsBot = ua.Device, ua.Browser, ua.OS, ua.IsBot

	// The request returns straight away; a pool worker hands the event to the
	// batcher and waits there until its batch is written. Analytics is best
	// effort: if the pool is saturated the event is dropped rather than
	// slowing anyone's request down.
	if err := SubmitJob(func() {
		id := uuid.NewString()
		s.pending.Store(id, *e)
		_, _ = s.batcher.Do(id)
	}); err != nil {
		log.Println("[WARN] site analytics event dropped, worker pool unavailable:", err)
	}
}

func (s *SiteEventsService) flush(ids []string) (map[string]any, error) {
	events := make([]domain.SiteEvent, 0, len(ids))
	for _, id := range ids {
		if v, ok := s.pending.LoadAndDelete(id); ok {
			events = append(events, v.(domain.SiteEvent))
		}
	}
	if len(events) == 0 {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := s.repo.InsertBatch(ctx, events); err != nil {
		log.Printf("[ERROR] failed to write %d site analytics events: %v", len(events), err)
		return nil, err
	}
	return nil, nil
}

func (s *SiteEventsService) Close() {
	if s.batcher != nil {
		s.batcher.Stop()
	}
}

// normalizeCountry accepts only a real ISO-3166 alpha-2 code. Cloudflare uses
// "XX" for unknown and "T1" for Tor, which are not countries.
func normalizeCountry(c string) string {
	c = strings.ToUpper(strings.TrimSpace(c))
	if len(c) != 2 || c == "XX" || c == "T1" {
		return ""
	}
	return c
}

func (s *SiteEventsService) Track(req dto.TrackEventRequest, meta RequestMeta) error {
	if !domain.BrowserEventTypes[req.Type] {
		return fmt.Errorf("%w: unknown event type", ErrInvalidSiteEvent)
	}
	path := cleanPath(req.Path)
	if req.Type == domain.SiteEventPageView && path == "" {
		return fmt.Errorf("%w: page_view needs a path", ErrInvalidSiteEvent)
	}

	e := &domain.SiteEvent{
		EventType:  req.Type,
		Source:     domain.SiteEventSourceWeb,
		Path:       path,
		Properties: cleanProperties(req.Properties),
	}
	if sessionIDPattern.MatchString(req.SessionID) {
		e.SessionID = req.SessionID
	}
	if req.Type == domain.SiteEventPageView && req.IsEntry {
		e.IsEntry = true
		e.ReferrerHost = referrerHost(req.Referrer)
		e.UTMSource = clip(req.UTMSource, 128)
		e.UTMMedium = clip(req.UTMMedium, 128)
		e.UTMCampaign = clip(req.UTMCampaign, 128)
	}
	s.store(e, meta)
	return nil
}

func (s *SiteEventsService) RecordServerEvent(eventType, path string, meta RequestMeta) {
	s.store(&domain.SiteEvent{
		EventType: eventType,
		Source:    domain.SiteEventSourceAPI,
		Path:      cleanPath(path),
	}, meta)
}

// ResolveRange turns inclusive YYYY-MM-DD dates (league time) into the
// half-open [from, to) instant range queries use. An empty from means "since
// tracking could have begun"; an empty to means today.
func ResolveRange(fromStr, toStr string, now time.Time) (time.Time, time.Time, error) {
	today := time.Date(now.In(siteLocation).Year(), now.In(siteLocation).Month(), now.In(siteLocation).Day(), 0, 0, 0, 0, siteLocation)

	from := time.Date(2020, 1, 1, 0, 0, 0, 0, siteLocation)
	if fromStr != "" {
		d, err := time.ParseInLocation("2006-01-02", fromStr, siteLocation)
		if err != nil {
			return from, from, fmt.Errorf("from must be YYYY-MM-DD")
		}
		from = d
	}
	toDay := today
	if toStr != "" {
		d, err := time.ParseInLocation("2006-01-02", toStr, siteLocation)
		if err != nil {
			return from, from, fmt.Errorf("to must be YYYY-MM-DD")
		}
		toDay = d
	}
	if toDay.Before(from) {
		return from, from, fmt.Errorf("to must not be before from")
	}
	return from, toDay.AddDate(0, 0, 1), nil
}

const maxFilledDays = 1100

func fillDailyGaps(points []dto.SiteDailyPoint, from, to time.Time) []dto.SiteDailyPoint {
	if int(to.Sub(from).Hours()/24) > maxFilledDays {
		return points
	}
	byDate := make(map[string]dto.SiteDailyPoint, len(points))
	for _, p := range points {
		byDate[p.Date] = p
	}
	out := []dto.SiteDailyPoint{}
	for d := from; d.Before(to); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		if p, ok := byDate[key]; ok {
			out = append(out, p)
		} else {
			out = append(out, dto.SiteDailyPoint{Date: key})
		}
	}
	return out
}

// spanDays is the number of league days in [from, to).
func spanDays(from, to time.Time) int {
	return int(math.Round(to.Sub(from).Hours() / 24))
}

// dailyStats averages unique visitors per day, overall and split by match
// day. Days before the first recorded visit are skipped, so a range that
// starts before tracking was switched on isn't dragged down by empty days.
func dailyStats(daily []dto.SiteDailyPoint) (float64, dto.SiteMatchDayStats) {
	first := -1
	for i, d := range daily {
		if d.PageViews > 0 {
			first = i
			break
		}
	}
	var md dto.SiteMatchDayStats
	if first < 0 {
		return 0, md
	}

	var all, onMatch, onOther int
	for _, d := range daily[first:] {
		all += d.Visitors
		if d.MatchDay {
			md.MatchDays++
			onMatch += d.Visitors
		} else {
			md.OtherDays++
			onOther += d.Visitors
		}
	}
	if md.MatchDays > 0 {
		md.AvgVisitorsMatchDay = float64(onMatch) / float64(md.MatchDays)
	}
	if md.OtherDays > 0 {
		md.AvgVisitorsOtherDay = float64(onOther) / float64(md.OtherDays)
	}
	return float64(all) / float64(len(daily)-first), md
}

// ValidDayFilter reports whether days is a day filter the reports understand.
// Empty means every day.
func ValidDayFilter(days string) bool {
	switch days {
	case "", dto.SiteDaysAll, dto.SiteDaysMatch, dto.SiteDaysOther:
		return true
	}
	return false
}

// scope resolves a day filter into the query scope for [from, to), returning
// the range's match days alongside so callers can name them.
func (s *SiteEventsService) scope(ctx context.Context, from, to time.Time, days string) (ports.SiteScope, []dto.SiteMatchDay, error) {
	matchDays, err := s.repo.MatchDays(ctx, from, to)
	if err != nil {
		return ports.SiteScope{}, nil, err
	}
	sc := ports.SiteScope{From: from, To: to}
	if days == dto.SiteDaysMatch || days == dto.SiteDaysOther {
		sc.DayMode = ports.DaysOnly
		if days == dto.SiteDaysOther {
			sc.DayMode = ports.DaysExcept
		}
		sc.Days = make([]string, len(matchDays))
		for i, d := range matchDays {
			sc.Days[i] = d.Date
		}
	}
	return sc, matchDays, nil
}

func (s *SiteEventsService) MatchDays(ctx context.Context, from, to time.Time) ([]dto.SiteMatchDay, error) {
	matchDays, err := s.repo.MatchDays(ctx, from, to)
	if err != nil {
		return nil, err
	}
	sc := ports.SiteScope{From: from, To: to}
	daily, err := s.repo.Daily(ctx, sc)
	if err != nil {
		return nil, err
	}
	return s.matchDayList(ctx, sc, matchDays, daily)
}

func (s *SiteEventsService) Scope(ctx context.Context, from, to time.Time, days string) (ports.SiteScope, error) {
	sc, _, err := s.scope(ctx, from, to, days)
	return sc, err
}

// dailySeries is one point per day in the scope's range, match days marked
// and named. With a day filter, only the days it keeps are returned.
func (s *SiteEventsService) dailySeries(ctx context.Context, sc ports.SiteScope, matchDays []dto.SiteMatchDay) ([]dto.SiteDailyPoint, error) {
	raw, err := s.repo.Daily(ctx, sc)
	if err != nil {
		return nil, err
	}
	names := make(map[string]string, len(matchDays))
	for _, d := range matchDays {
		names[d.Date] = d.Name()
	}

	all := fillDailyGaps(raw, sc.From, sc.To)
	daily := all[:0:0]
	for _, p := range all {
		name, isMatch := names[p.Date]
		p.MatchDay, p.MatchDayName = isMatch, name
		if (sc.DayMode == ports.DaysOnly && !isMatch) || (sc.DayMode == ports.DaysExcept && isMatch) {
			continue
		}
		daily = append(daily, p)
	}
	return daily, nil
}

// matchDayList puts each match day's traffic next to its name. It always
// reflects the real traffic on those days, even when the report excludes them.
func (s *SiteEventsService) matchDayList(ctx context.Context, sc ports.SiteScope, matchDays []dto.SiteMatchDay, daily []dto.SiteDailyPoint) ([]dto.SiteMatchDay, error) {
	if sc.DayMode == ports.DaysExcept {
		var err error
		if daily, err = s.repo.Daily(ctx, ports.SiteScope{From: sc.From, To: sc.To}); err != nil {
			return nil, err
		}
	}
	byDate := make(map[string]dto.SiteDailyPoint, len(daily))
	for _, p := range daily {
		byDate[p.Date] = p
	}
	out := make([]dto.SiteMatchDay, len(matchDays))
	for i, d := range matchDays {
		d.PageViews, d.Visitors = byDate[d.Date].PageViews, byDate[d.Date].Visitors
		out[i] = d
	}
	return out, nil
}

// plainPageTitle names a top-level page from its path ("/" is Home,
// "/fantasy" is Fantasy). Deeper paths without a record behind them get no name.
func plainPageTitle(path string) string {
	if path == "/" {
		return "Home"
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 1 || parts[0] == "" {
		return ""
	}
	words := strings.Fields(strings.ReplaceAll(parts[0], "-", " "))
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

// entityRankings fills the most-viewed news, players and teams, each named
// from its record (headline, player or team name) with one label lookup.
func (s *SiteEventsService) entityRankings(ctx context.Context, sum *dto.SiteTrafficSummary, sc ports.SiteScope) error {
	lists := []struct {
		dst  *[]dto.SiteBreakdownRow
		kind string
	}{
		{&sum.TopNews, "news"},
		{&sum.TopPlayers, "players"},
		{&sum.TopTeams, "teams"},
	}
	var paths []string
	for _, l := range lists {
		rows, err := s.repo.EntityRanking(ctx, l.kind, sc, 10)
		if err != nil {
			return err
		}
		*l.dst = rows
		for _, r := range rows {
			paths = append(paths, r.Name)
		}
	}
	labels, err := s.repo.PageLabels(ctx, paths)
	if err != nil {
		return err
	}
	for _, l := range lists {
		for i := range *l.dst {
			(*l.dst)[i].Label = labels[(*l.dst)[i].Name]
		}
	}
	return nil
}

func siteDay(t time.Time) string { return t.In(siteLocation).Format("2006-01-02") }

func (s *SiteEventsService) Summary(ctx context.Context, from, to time.Time, days string, compare bool) (*dto.SiteTrafficSummary, error) {
	if days == "" {
		days = dto.SiteDaysAll
	}
	sc, matchDays, err := s.scope(ctx, from, to, days)
	if err != nil {
		return nil, err
	}
	sum := &dto.SiteTrafficSummary{From: siteDay(from), To: siteDay(to.AddDate(0, 0, -1)), Days: days}

	if sum.Totals, err = s.repo.Totals(ctx, sc); err != nil {
		return nil, err
	}
	if sum.Daily, err = s.dailySeries(ctx, sc, matchDays); err != nil {
		return nil, err
	}
	sum.Totals.AvgDailyVisitors, sum.MatchDays = dailyStats(sum.Daily)
	if sum.MatchDayList, err = s.matchDayList(ctx, sc, matchDays, sum.Daily); err != nil {
		return nil, err
	}

	if sum.Monthly, err = s.repo.Monthly(ctx, sc); err != nil {
		return nil, err
	}
	if sum.Heatmap, err = s.repo.Heatmap(ctx, sc); err != nil {
		return nil, err
	}

	breakdowns := []struct {
		dst   *[]dto.SiteBreakdownRow
		dim   string
		limit int
	}{
		{&sum.Sections, "section", 10},
		{&sum.TopPages, "page", 15},
		{&sum.Sources, "source", 10},
		{&sum.Campaigns, "campaign", 10},
		{&sum.Countries, "country", 10},
		{&sum.Devices, "device", 5},
		{&sum.Browsers, "browser", 8},
		{&sum.OSes, "os", 8},
		{&sum.Actions, "action", 20},
	}
	for _, b := range breakdowns {
		if *b.dst, err = s.repo.Breakdown(ctx, b.dim, sc, b.limit); err != nil {
			return nil, err
		}
	}

	paths := make([]string, len(sum.TopPages))
	for i, p := range sum.TopPages {
		paths[i] = p.Name
	}
	labels, err := s.repo.PageLabels(ctx, paths)
	if err != nil {
		return nil, err
	}
	for i := range sum.TopPages {
		if label := labels[sum.TopPages[i].Name]; label != "" {
			sum.TopPages[i].Label = label
		} else {
			sum.TopPages[i].Label = plainPageTitle(sum.TopPages[i].Name)
		}
	}

	if sum.TopMatches, err = s.repo.TopMatches(ctx, sc, 10); err != nil {
		return nil, err
	}
	if err := s.entityRankings(ctx, sum, sc); err != nil {
		return nil, err
	}
	if sum.TicketFunnel, err = s.repo.TicketFunnel(ctx, sc); err != nil {
		return nil, err
	}
	if sum.Conversions, err = s.repo.Conversions(ctx, sc); err != nil {
		return nil, err
	}

	// The comparison period uses the same day filter, so "match days only"
	// compares this period's match days with the previous period's.
	if compare {
		prevFrom, prevTo := from.AddDate(0, 0, -spanDays(from, to)), from
		prevScope, prevMatchDays, err := s.scope(ctx, prevFrom, prevTo, days)
		if err != nil {
			return nil, err
		}
		prev := &dto.SitePeriod{From: siteDay(prevFrom), To: siteDay(prevTo.AddDate(0, 0, -1))}
		if prev.Totals, err = s.repo.Totals(ctx, prevScope); err != nil {
			return nil, err
		}
		prevDaily, err := s.dailySeries(ctx, prevScope, prevMatchDays)
		if err != nil {
			return nil, err
		}
		prev.Totals.AvgDailyVisitors, _ = dailyStats(prevDaily)
		if prev.Conversions, err = s.repo.Conversions(ctx, prevScope); err != nil {
			return nil, err
		}
		sum.Previous = prev
	}
	return sum, nil
}

func (s *SiteEventsService) ListEvents(ctx context.Context, f ports.SiteEventFilter, page, limit int) (*dto.SiteEventsPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	events, total, err := s.repo.ListEvents(ctx, f, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}
	if events == nil {
		events = []domain.SiteEvent{}
	}
	return &dto.SiteEventsPage{Events: events, Total: total, Page: page, Limit: limit}, nil
}

// csvCell neutralises spreadsheet formula injection. Paths, referrers and
// campaign names are attacker-controlled, and Excel runs a cell that starts
// with = + - or @ as a formula.
func csvCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

// newCSVWriter leads with a UTF-8 byte-order mark so Excel detects the encoding
// instead of mangling non-ASCII text.
func newCSVWriter(w io.Writer) (*csv.Writer, error) {
	if _, err := w.Write([]byte("\xEF\xBB\xBF")); err != nil {
		return nil, err
	}
	return csv.NewWriter(w), nil
}

func (s *SiteEventsService) ExportEventsCSV(ctx context.Context, f ports.SiteEventFilter, w io.Writer) error {
	cw, err := newCSVWriter(w)
	if err != nil {
		return err
	}
	if err := cw.Write([]string{
		"Time (Lagos)", "Event", "Source", "Path", "Entry page", "Referrer", "UTM source",
		"UTM medium", "UTM campaign", "Session", "IP", "Country", "Device", "Browser", "OS",
		"Bot", "Properties",
	}); err != nil {
		return err
	}

	err = s.repo.StreamEvents(ctx, f, func(e domain.SiteEvent) error {
		props := ""
		if len(e.Properties) > 0 {
			if b, err := json.Marshal(e.Properties); err == nil {
				props = string(b)
			}
		}
		return cw.Write([]string{
			e.CreatedAt.In(siteLocation).Format("2006-01-02 15:04:05"),
			e.EventType, e.Source, csvCell(e.Path), strconv.FormatBool(e.IsEntry),
			csvCell(e.ReferrerHost), csvCell(e.UTMSource), csvCell(e.UTMMedium), csvCell(e.UTMCampaign),
			e.SessionID, e.IP, e.Country, e.DeviceType, e.Browser, e.OS,
			strconv.FormatBool(e.IsBot), csvCell(props),
		})
	})
	cw.Flush()
	if err != nil {
		return err
	}
	return cw.Error()
}

var weekdayNames = [...]string{"", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

// ptsChange renders the change between two rates (0-1) in percentage points,
// which is how a bounce rate moving from 40% to 44% should read (+4.0 pts,
// not +10%).
func ptsChange(cur, prev float64) string {
	return fmt.Sprintf("%+.1f pts", (cur-prev)*100)
}

// pctChange renders the change from prev to cur, or "n/a" when there is no
// earlier figure to compare against.
func pctChange(cur, prev float64) string {
	if prev == 0 {
		return "n/a"
	}
	return fmt.Sprintf("%+.1f%%", (cur-prev)/prev*100)
}

// ExportSummaryCSV writes the audience report: headline figures (with the
// previous period when compare is set), match-day uplift, monthly and daily
// series, busiest times and every ranked list. It is laid out to be pasted
// into a sponsorship deck or opened by an analyst in a spreadsheet.
func (s *SiteEventsService) ExportSummaryCSV(ctx context.Context, from, to time.Time, days string, compare bool, w io.Writer) error {
	sum, err := s.Summary(ctx, from, to, days, compare)
	if err != nil {
		return err
	}
	cw, err := newCSVWriter(w)
	if err != nil {
		return err
	}

	row := func(cells ...string) { _ = cw.Write(cells) }
	itoa := strconv.Itoa
	f1 := func(v float64) string { return strconv.FormatFloat(v, 'f', 1, 64) }
	f2 := func(v float64) string { return strconv.FormatFloat(v, 'f', 2, 64) }
	pct := func(v float64) string { return strconv.FormatFloat(v*100, 'f', 1, 64) + "%" }

	row("Showtime Flag Football League - website audience report")
	row("Period", sum.From+" to "+sum.To)
	row("Days included", map[string]string{
		dto.SiteDaysAll:   "Every day",
		dto.SiteDaysMatch: "Match days only",
		dto.SiteDaysOther: "Every day except match days",
	}[sum.Days])
	row("Notes", "Times are Africa/Lagos. Automated traffic (bots) excluded. Unique visitors are distinct IP addresses.")
	row()

	cur, conv := sum.Totals, sum.Conversions
	var prev dto.SiteTotals
	var prevConv dto.SiteConversions
	if sum.Previous != nil {
		prev, prevConv = sum.Previous.Totals, sum.Previous.Conversions
		row("Headline figures", "This period", "Previous period ("+sum.Previous.From+" to "+sum.Previous.To+")", "Change")
	} else {
		row("Headline figures", "This period")
	}
	metric := func(name, curStr, prevStr string, curV, prevV float64) {
		if sum.Previous != nil {
			row(name, curStr, prevStr, pctChange(curV, prevV))
		} else {
			row(name, curStr)
		}
	}
	metric("Page views", itoa(cur.PageViews), itoa(prev.PageViews), float64(cur.PageViews), float64(prev.PageViews))
	metric("Unique visitors", itoa(cur.UniqueVisitors), itoa(prev.UniqueVisitors), float64(cur.UniqueVisitors), float64(prev.UniqueVisitors))
	metric("Average daily visitors", f1(cur.AvgDailyVisitors), f1(prev.AvgDailyVisitors), cur.AvgDailyVisitors, prev.AvgDailyVisitors)
	metric("New visitors", itoa(cur.NewVisitors), itoa(prev.NewVisitors), float64(cur.NewVisitors), float64(prev.NewVisitors))
	metric("Returning visitors", itoa(cur.ReturningVisitors), itoa(prev.ReturningVisitors), float64(cur.ReturningVisitors), float64(prev.ReturningVisitors))
	metric("Sessions (visits)", itoa(cur.Sessions), itoa(prev.Sessions), float64(cur.Sessions), float64(prev.Sessions))
	metric("Pages per session", f2(cur.PagesPerSession), f2(prev.PagesPerSession), cur.PagesPerSession, prev.PagesPerSession)
	if sum.Previous != nil && prev.Sessions > 0 {
		row("Bounce rate (single-page visits)", pct(cur.BounceRate), pct(prev.BounceRate), ptsChange(cur.BounceRate, prev.BounceRate))
	} else {
		metric("Bounce rate (single-page visits)", pct(cur.BounceRate), pct(prev.BounceRate), cur.BounceRate, 0)
	}
	metric("Tracked actions (logins, sign-ups, checkouts...)", itoa(cur.ActionEvents), itoa(prev.ActionEvents), float64(cur.ActionEvents), float64(prev.ActionEvents))
	metric("New accounts", itoa(conv.NewUsers), itoa(prevConv.NewUsers), float64(conv.NewUsers), float64(prevConv.NewUsers))
	metric("Tickets sold", itoa(conv.TicketsSold), itoa(prevConv.TicketsSold), float64(conv.TicketsSold), float64(prevConv.TicketsSold))
	metric("Ticket revenue (NGN)", itoa(conv.TicketRevenue), itoa(prevConv.TicketRevenue), float64(conv.TicketRevenue), float64(prevConv.TicketRevenue))
	metric("Store orders", itoa(conv.StoreOrders), itoa(prevConv.StoreOrders), float64(conv.StoreOrders), float64(prevConv.StoreOrders))
	metric("Store revenue (NGN)", f2(conv.StoreRevenue), f2(prevConv.StoreRevenue), conv.StoreRevenue, prevConv.StoreRevenue)
	row("Automated visits excluded", itoa(cur.BotEventsExcluded))
	row()

	md := sum.MatchDays
	if sum.Days == dto.SiteDaysAll {
		row("Match days", "Days", "Average daily visitors")
		row("Match days (event day or fixture)", itoa(md.MatchDays), f1(md.AvgVisitorsMatchDay))
		row("Other days", itoa(md.OtherDays), f1(md.AvgVisitorsOtherDay))
		if md.MatchDays > 0 && md.AvgVisitorsOtherDay > 0 {
			row("Match-day uplift", "", pctChange(md.AvgVisitorsMatchDay, md.AvgVisitorsOtherDay))
		}
		row()
	}

	row("Match day", "Date", "Fixtures", "Page views", "Unique visitors")
	for _, d := range sum.MatchDayList {
		row(csvCell(d.Name()), d.Date, csvCell(d.Games), itoa(d.PageViews), itoa(d.Visitors))
	}
	row()

	row("Month", "Page views", "Unique visitors", "Sessions")
	for _, m := range sum.Monthly {
		row(m.Month, itoa(m.PageViews), itoa(m.Visitors), itoa(m.Sessions))
	}
	row()

	slots := append([]dto.SiteHeatCell(nil), sum.Heatmap...)
	sort.SliceStable(slots, func(i, j int) bool { return slots[i].PageViews > slots[j].PageViews })
	if len(slots) > 10 {
		slots = slots[:10]
	}
	row("Busiest times (Lagos)", "Page views")
	for _, c := range slots {
		row(fmt.Sprintf("%s %02d:00-%02d:00", weekdayNames[c.Weekday], c.Hour, (c.Hour+1)%24), itoa(c.PageViews))
	}
	row()

	row("Date", "Page views", "Unique visitors", "Match day")
	for _, d := range sum.Daily {
		matchDay := ""
		if d.MatchDay {
			matchDay = "Yes"
		}
		row(d.Date, itoa(d.PageViews), itoa(d.Visitors), matchDay)
	}
	row()

	f := sum.TicketFunnel
	ofPrev := func(cur, prev int) string {
		if prev == 0 {
			return ""
		}
		return pct(float64(cur) / float64(prev))
	}
	row("Ticket funnel", "Count", "Share of previous step")
	row("Visitors (distinct IPs)", itoa(f.Visitors))
	row("Visited a ticket page", itoa(f.TicketPageVisitors), ofPrev(f.TicketPageVisitors, f.Visitors))
	row("Started a ticket checkout", itoa(f.CheckoutStarters), ofPrev(f.CheckoutStarters, f.TicketPageVisitors))
	row("Paid online ticket orders (from ticket records)", itoa(f.PaidOrders), ofPrev(f.PaidOrders, f.CheckoutStarters))
	row()

	row("Most viewed matches", "Match date", "Page views", "Unique visitors", "Before match day", "On match day", "After match day")
	for _, m := range sum.TopMatches {
		row(csvCell(m.Label), m.Date, itoa(m.Views), itoa(m.Visitors), itoa(m.BuildUp), itoa(m.MatchDay), itoa(m.After))
	}
	row()

	for _, list := range []struct {
		title string
		rows  []dto.SiteBreakdownRow
	}{
		{"Most read news", sum.TopNews},
		{"Most viewed players", sum.TopPlayers},
		{"Most viewed teams", sum.TopTeams},
		{"Top pages (all)", sum.TopPages},
	} {
		row(list.title, "Page", "Page views", "Unique visitors")
		for _, r := range list.rows {
			row(csvCell(r.Label), csvCell(r.Name), itoa(r.Count), itoa(r.Visitors))
		}
		row()
	}

	sections := []struct {
		title, countLabel string
		rows              []dto.SiteBreakdownRow
	}{
		{"Site sections", "Page views", sum.Sections},
		{"Traffic sources (visits)", "Visits", sum.Sources},
		{"Campaigns (visits)", "Visits", sum.Campaigns},
		{"Countries", "Page views", sum.Countries},
		{"Devices", "Page views", sum.Devices},
		{"Browsers", "Page views", sum.Browsers},
		{"Operating systems", "Page views", sum.OSes},
		{"Tracked actions", "Count", sum.Actions},
	}
	for _, sec := range sections {
		row(sec.title, sec.countLabel, "Unique visitors")
		for _, r := range sec.rows {
			row(csvCell(r.Name), itoa(r.Count), itoa(r.Visitors))
		}
		row()
	}

	cw.Flush()
	return cw.Error()
}
