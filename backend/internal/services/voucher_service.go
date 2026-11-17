package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
)

const (
	voucherMaxSpanDays = 366
	voucherMaxItems    = 20
	voucherCodeTries   = 5
)

// Errors a caller can show the user as they are.
var (
	ErrVoucherProductInvalid = errors.New("a voucher bundle needs a name, a price above zero and at least one item")
	ErrVoucherProductGone    = errors.New("that voucher is not on sale")
	ErrVoucherHolder         = errors.New("say who the voucher is for")
	ErrVoucherHolderEmail    = errors.New("that email address does not look right")
	ErrVoucherDates          = errors.New("choose valid dates: the last day cannot be before the first, and the first cannot be in the past")
	ErrVoucherSpan           = errors.New("a voucher can cover at most a year")
	ErrVoucherNotFound       = ports.ErrVoucherNotFound
	ErrVoucherNotVoidable    = ports.ErrVoucherNotVoidable
)

// What the voucher service needs from the rest of the app, kept small so each can be faked.
type (
	voucherUsers interface {
		GetUserByID(ctx context.Context, id string) (*domain.User, error)
	}
	voucherUserSearch interface {
		AdminSearchUsers(ctx context.Context, search string) ([]dto.WalletUser, error)
	}
)

type IVoucherService interface {
	// ListProducts is the bundles on sale.
	ListProducts(ctx context.Context) ([]domain.VoucherProduct, error)
	// Purchase pays for a voucher from the buyer's wallet.
	Purchase(ctx context.Context, buyerID string, req dto.PurchaseVoucherRequest) (*dto.VoucherView, error)
	ListMine(ctx context.Context, userID string) ([]dto.VoucherView, error)
	// GetByCode shows a voucher to whoever holds its code (the voucher page, the bar).
	GetByCode(ctx context.Context, code string) (*dto.VoucherView, error)
	// Redeem uses a voucher up at the bar.
	Redeem(ctx context.Context, code, staffID string) (*dto.RedeemVoucherResponse, error)

	AdminListProducts(ctx context.Context) ([]domain.VoucherProduct, error)
	AdminCreateProduct(ctx context.Context, req dto.VoucherProductRequest) (*domain.VoucherProduct, error)
	AdminUpdateProduct(ctx context.Context, id string, req dto.VoucherProductRequest) (*domain.VoucherProduct, error)
	AdminIssue(ctx context.Context, staffID string, req dto.IssueVoucherRequest) (*dto.AdminVoucherView, error)
	AdminList(ctx context.Context, f ports.VoucherFilter) (*dto.AdminVoucherList, error)
	AdminVoid(ctx context.Context, id, staffID string, refund bool) (*dto.AdminVoucherView, error)
	AdminRedemptions(ctx context.Context) ([]dto.AdminVoucherView, error)
	AdminSearchUsers(ctx context.Context, search string) ([]dto.WalletUser, error)
}

type VoucherService struct {
	repo   ports.IVoucherRepository
	users  voucherUsers
	search voucherUserSearch
	email  ports.EmailService
	now    func() time.Time
}

func NewVoucherService(repo ports.IVoucherRepository, users voucherUsers, search voucherUserSearch) *VoucherService {
	return &VoucherService{repo: repo, users: users, search: search, now: time.Now}
}

// WithEmail turns on the voucher emails.
func (s *VoucherService) WithEmail(e ports.EmailService) *VoucherService {
	s.email = e
	return s
}

// ---- codes and dates ----

// generateVoucherCode makes a code like VCH-7K2M9QXATB. The alphabet leaves out
// look-alike characters (0/O, 1/I) because staff may have to type it.
func generateVoucherCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 10)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return "VCH-" + string(b)
}

// normalizeVoucherCode accepts what staff type or a scanner reads: the bare code in
// any case, with stray spaces, or the whole voucher link.
func normalizeVoucherCode(raw string) string {
	s := strings.TrimSpace(raw)
	if i := strings.IndexAny(s, "?#"); i >= 0 {
		s = s[:i]
	}
	s = strings.TrimRight(s, "/")
	if i := strings.LastIndex(s, "/"); i >= 0 {
		s = s[i+1:]
	}
	return strings.ToUpper(strings.TrimSpace(s))
}

const voucherDateLayout = "2006-01-02"

func parseVoucherDates(from, to string, today time.Time) (time.Time, time.Time, error) {
	f, err := time.Parse(voucherDateLayout, strings.TrimSpace(from))
	if err != nil {
		return time.Time{}, time.Time{}, ErrVoucherDates
	}
	t, err := time.Parse(voucherDateLayout, strings.TrimSpace(to))
	if err != nil {
		return time.Time{}, time.Time{}, ErrVoucherDates
	}
	if t.Before(f) || f.Before(today) {
		return time.Time{}, time.Time{}, ErrVoucherDates
	}
	if t.Sub(f) > (voucherMaxSpanDays-1)*24*time.Hour {
		return time.Time{}, time.Time{}, ErrVoucherSpan
	}
	return f, t, nil
}

func voucherStateMessage(v *domain.Voucher, state domain.VoucherState) string {
	switch state {
	case domain.VoucherStateValid:
		return "Valid today"
	case domain.VoucherStateNotYet:
		return "Not valid until " + v.ValidFrom.Format("2 Jan 2006")
	case domain.VoucherStateExpired:
		return "Expired on " + v.ValidTo.Format("2 Jan 2006")
	case domain.VoucherStateRedeemed:
		if v.RedeemedAt != nil {
			return "Already used on " + v.RedeemedAt.In(lagos()).Format("2 Jan 2006 at 15:04")
		}
		return "Already used"
	case domain.VoucherStateVoid:
		return "This voucher was cancelled"
	}
	return ""
}

func (s *VoucherService) view(v *domain.Voucher) dto.VoucherView {
	state := v.StateOn(todayLagos(s.now()))
	items := v.Items
	if items == nil {
		items = []domain.VoucherItem{}
	}
	return dto.VoucherView{
		ID:             v.ID,
		Code:           v.Code,
		Name:           v.Name,
		Items:          items,
		HolderName:     v.HolderName,
		ValidFrom:      v.ValidFrom.Format(voucherDateLayout),
		ValidTo:        v.ValidTo.Format(voucherDateLayout),
		Status:         v.Status,
		State:          state,
		StateMessage:   voucherStateMessage(v, state),
		Redeemable:     state == domain.VoucherStateValid,
		RedeemedAt:     v.RedeemedAt,
		RedeemedByName: v.RedeemedByName,
		CreatedAt:      v.CreatedAt,
	}
}

func (s *VoucherService) adminView(v *domain.Voucher) dto.AdminVoucherView {
	return dto.AdminVoucherView{
		VoucherView:       s.view(v),
		Source:            v.Source,
		PriceKobo:         v.PriceKobo,
		HolderEmail:       v.HolderEmail,
		HolderUserID:      v.HolderUserID,
		PurchasedByUserID: v.PurchasedByUserID,
	}
}

// ---- products ----

func cleanProduct(req dto.VoucherProductRequest) (name, description string, items []domain.VoucherItem, err error) {
	name = strings.TrimSpace(req.Name)
	description = strings.TrimSpace(req.Description)
	for _, it := range req.Items {
		n := strings.TrimSpace(it.Name)
		if n == "" {
			continue
		}
		if it.Qty < 1 || it.Qty > 99 {
			return "", "", nil, ErrVoucherProductInvalid
		}
		items = append(items, domain.VoucherItem{Name: n, Qty: it.Qty})
	}
	if name == "" || len(name) > 100 || req.PriceKobo <= 0 || len(items) == 0 || len(items) > voucherMaxItems {
		return "", "", nil, ErrVoucherProductInvalid
	}
	return name, description, items, nil
}

func (s *VoucherService) ListProducts(ctx context.Context) ([]domain.VoucherProduct, error) {
	return s.repo.ListProducts(ctx, true)
}

func (s *VoucherService) AdminListProducts(ctx context.Context) ([]domain.VoucherProduct, error) {
	return s.repo.ListProducts(ctx, false)
}

func (s *VoucherService) AdminCreateProduct(ctx context.Context, req dto.VoucherProductRequest) (*domain.VoucherProduct, error) {
	name, desc, items, err := cleanProduct(req)
	if err != nil {
		return nil, err
	}
	p := &domain.VoucherProduct{Name: name, Description: desc, PriceKobo: req.PriceKobo, Items: items, Active: req.Active}
	if err := s.repo.CreateProduct(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *VoucherService) AdminUpdateProduct(ctx context.Context, id string, req dto.VoucherProductRequest) (*domain.VoucherProduct, error) {
	if !isUUID(id) {
		return nil, ErrVoucherProductGone
	}
	name, desc, items, err := cleanProduct(req)
	if err != nil {
		return nil, err
	}
	p := &domain.VoucherProduct{ID: id, Name: name, Description: desc, PriceKobo: req.PriceKobo, Items: items, Active: req.Active}
	found, err := s.repo.UpdateProduct(ctx, p)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrVoucherProductGone
	}
	return p, nil
}

// ---- making vouchers ----

type holderInput struct {
	name, email string
}

func cleanHolder(name, emailAddr string) (holderInput, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 100 {
		return holderInput{}, ErrVoucherHolder
	}
	emailAddr = strings.TrimSpace(emailAddr)
	if emailAddr != "" {
		parsed, err := mail.ParseAddress(emailAddr)
		if err != nil || parsed.Address != emailAddr {
			return holderInput{}, ErrVoucherHolderEmail
		}
	}
	return holderInput{name: name, email: emailAddr}, nil
}

func snapshot(p *domain.VoucherProduct, h holderInput, from, to time.Time) *domain.Voucher {
	items := make([]domain.VoucherItem, len(p.Items))
	copy(items, p.Items)
	pid := p.ID
	v := &domain.Voucher{
		ProductID:  &pid,
		Name:       p.Name,
		Items:      items,
		PriceKobo:  p.PriceKobo,
		HolderName: h.name,
		ValidFrom:  from,
		ValidTo:    to,
	}
	if h.email != "" {
		e := h.email
		v.HolderEmail = &e
	}
	return v
}

// save stores a voucher under a fresh code, trying again if the code is taken.
func (s *VoucherService) save(ctx context.Context, v *domain.Voucher, store func(context.Context, *domain.Voucher) error) error {
	for i := 0; i < voucherCodeTries; i++ {
		v.Code = generateVoucherCode()
		err := store(ctx, v)
		if !errors.Is(err, ports.ErrVoucherCodeTaken) {
			return err
		}
	}
	return errors.New("could not make a unique voucher code, please try again")
}

func (s *VoucherService) Purchase(ctx context.Context, buyerID string, req dto.PurchaseVoucherRequest) (*dto.VoucherView, error) {
	if !isUUID(req.ProductID) {
		return nil, ErrVoucherProductGone
	}
	product, err := s.repo.GetProduct(ctx, req.ProductID)
	if err != nil {
		return nil, err
	}
	if product == nil || !product.Active {
		return nil, ErrVoucherProductGone
	}
	holder, err := cleanHolder(req.HolderName, req.HolderEmail)
	if err != nil {
		return nil, err
	}
	from, to, err := parseVoucherDates(req.ValidFrom, req.ValidTo, todayLagos(s.now()))
	if err != nil {
		return nil, err
	}

	v := snapshot(product, holder, from, to)
	v.Source = domain.VoucherPurchased
	v.PurchasedByUserID = &buyerID
	if err := s.save(ctx, v, s.repo.CreatePurchased); err != nil {
		return nil, err
	}

	s.sendEmails(ctx, v)
	out := s.view(v)
	return &out, nil
}

func (s *VoucherService) AdminIssue(ctx context.Context, staffID string, req dto.IssueVoucherRequest) (*dto.AdminVoucherView, error) {
	// An admin may issue a bundle that is no longer on sale, so only existence is checked.
	if !isUUID(req.ProductID) {
		return nil, ErrVoucherProductGone
	}
	product, err := s.repo.GetProduct(ctx, req.ProductID)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, ErrVoucherProductGone
	}

	emailAddr := req.HolderEmail
	var linked *domain.User
	if id := strings.TrimSpace(req.HolderUserID); id != "" {
		if !isUUID(id) {
			return nil, ErrWalletUserNotFound
		}
		linked, err = s.users.GetUserByID(ctx, id)
		if err != nil || linked == nil {
			return nil, ErrWalletUserNotFound
		}
		if strings.TrimSpace(emailAddr) == "" {
			emailAddr = linked.Email
		}
	}
	holder, err := cleanHolder(req.HolderName, emailAddr)
	if err != nil {
		return nil, err
	}
	from, to, err := parseVoucherDates(req.ValidFrom, req.ValidTo, todayLagos(s.now()))
	if err != nil {
		return nil, err
	}

	v := snapshot(product, holder, from, to)
	v.Source = domain.VoucherAdminIssued
	v.IssuedByUserID = &staffID
	if linked != nil {
		uid := linked.ID
		v.HolderUserID = &uid
	}
	if err := s.save(ctx, v, s.repo.CreateIssued); err != nil {
		return nil, err
	}

	s.sendEmails(ctx, v)
	out := s.adminView(v)
	return &out, nil
}

// ---- reading ----

func (s *VoucherService) ListMine(ctx context.Context, userID string) ([]dto.VoucherView, error) {
	list, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.VoucherView, 0, len(list))
	for i := range list {
		out = append(out, s.view(&list[i]))
	}
	return out, nil
}

// isUUID keeps ids that can't exist away from the database, which would reject
// them with a confusing error instead of a plain "not found".
func isUUID(id string) bool {
	_, err := uuid.Parse(id)
	return err == nil
}

// PublicView is a voucher as anyone holding its link sees it: no internal id and
// no name of the staff member who redeemed it.
func PublicView(v dto.VoucherView) dto.VoucherView {
	v.ID = ""
	v.RedeemedByName = ""
	return v
}

func (s *VoucherService) GetByCode(ctx context.Context, code string) (*dto.VoucherView, error) {
	v, err := s.repo.GetByCode(ctx, normalizeVoucherCode(code))
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, ErrVoucherNotFound
	}
	out := s.view(v)
	return &out, nil
}

func (s *VoucherService) Redeem(ctx context.Context, code, staffID string) (*dto.RedeemVoucherResponse, error) {
	v, redeemed, err := s.repo.Redeem(ctx, normalizeVoucherCode(code), staffID, todayLagos(s.now()))
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, ErrVoucherNotFound
	}
	return &dto.RedeemVoucherResponse{Redeemed: redeemed, Voucher: s.view(v)}, nil
}

func (s *VoucherService) AdminList(ctx context.Context, f ports.VoucherFilter) (*dto.AdminVoucherList, error) {
	f.Search = strings.TrimSpace(f.Search)
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	list, total, err := s.repo.List(ctx, f)
	if err != nil {
		return nil, err
	}
	data := make([]dto.AdminVoucherView, 0, len(list))
	for i := range list {
		data = append(data, s.adminView(&list[i]))
	}
	return &dto.AdminVoucherList{Data: data, Total: total, Page: f.Page, Limit: f.Limit}, nil
}

func (s *VoucherService) AdminRedemptions(ctx context.Context) ([]dto.AdminVoucherView, error) {
	list, err := s.repo.ListRedemptions(ctx, 100)
	if err != nil {
		return nil, err
	}
	out := make([]dto.AdminVoucherView, 0, len(list))
	for i := range list {
		out = append(out, s.adminView(&list[i]))
	}
	return out, nil
}

func (s *VoucherService) AdminVoid(ctx context.Context, id, staffID string, refund bool) (*dto.AdminVoucherView, error) {
	if !isUUID(id) {
		return nil, ErrVoucherNotFound
	}
	v, err := s.repo.Void(ctx, id, staffID, refund)
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, ErrVoucherNotFound
	}
	out := s.adminView(v)
	return &out, nil
}

func (s *VoucherService) AdminSearchUsers(ctx context.Context, search string) ([]dto.WalletUser, error) {
	return s.search.AdminSearchUsers(ctx, search)
}

// ---- email ----

func voucherEmailItems(items []domain.VoucherItem) []email.VoucherEmailItem {
	out := make([]email.VoucherEmailItem, len(items))
	for i, it := range items {
		out[i] = email.VoucherEmailItem{Name: it.Name, Qty: it.Qty}
	}
	return out
}

// sendEmails sends the voucher to the person it is for (when we have their email)
// and, for a purchase, a copy to the buyer. It runs in the background and a failure
// to send never undoes the voucher.
func (s *VoucherService) sendEmails(ctx context.Context, v *domain.Voucher) {
	if s.email == nil {
		return
	}
	data := email.VoucherEmailData{
		HolderName:  v.HolderName,
		VoucherName: v.Name,
		Code:        v.Code,
		Items:       voucherEmailItems(v.Items),
		ValidFrom:   v.ValidFrom.Format("Mon 2 Jan 2006"),
		ValidTo:     v.ValidTo.Format("Mon 2 Jan 2006"),
		Free:        v.Source == domain.VoucherAdminIssued,
	}

	type letter struct{ to, html string }
	var letters []letter

	var buyerEmail string
	var buyerName string
	if v.PurchasedByUserID != nil && s.users != nil {
		if u, err := s.users.GetUserByID(ctx, *v.PurchasedByUserID); err == nil && u != nil {
			buyerEmail = strings.TrimSpace(u.Email)
			buyerName = strings.TrimSpace(u.FirstName)
			if buyerName == "" {
				buyerName = walletUserName(u)
			}
		}
	}

	if v.HolderEmail != nil && *v.HolderEmail != "" {
		d := data
		d.Greeting = v.HolderName
		if !strings.EqualFold(*v.HolderEmail, buyerEmail) {
			d.GiftedBy = buyerName
		}
		letters = append(letters, letter{to: *v.HolderEmail, html: email.VoucherEmailHTML(d)})
	}
	if buyerEmail != "" && (v.HolderEmail == nil || !strings.EqualFold(*v.HolderEmail, buyerEmail)) {
		d := data
		d.Greeting = buyerName
		if d.Greeting == "" {
			d.Greeting = "there"
		}
		letters = append(letters, letter{to: buyerEmail, html: email.VoucherEmailHTML(d)})
	}

	for _, l := range letters {
		l := l
		_ = SubmitJob(func() {
			if err := s.email.SendEmail(l.to, "Your Showtime voucher", l.html); err != nil {
				fmt.Printf("⚠️ WARNING: voucher email to %s failed: %s\n", l.to, err.Error())
			}
		})
	}
}
