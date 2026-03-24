package ports

import (
	"context"
	"errors"
	"fmt"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IInventoryRepository interface {
	CreateProduct(ctx context.Context, p domain.Product) (*domain.Product, error)
	UpdateProduct(ctx context.Context, id string, p domain.Product) (*domain.Product, error)
	DeleteProduct(ctx context.Context, id string) error
	GetProduct(ctx context.Context, id string) (*domain.Product, error)
	ListProducts(ctx context.Context, page, limit int, search string, activeOnly bool) ([]domain.Product, int, error)
	GetLowStockProducts(ctx context.Context) ([]domain.Product, error)
	LogSale(ctx context.Context, sale domain.Sale) (*domain.Sale, error)
	ListSales(ctx context.Context, page, limit int, productID, sellerID *string, fromDate, toDate *time.Time) ([]domain.Sale, int, error)
	GetRawSalesReport(ctx context.Context, fromDate, toDate time.Time) (*SalesReportData, error)

	ListPaymentMethods(ctx context.Context, activeOnly bool) ([]domain.PaymentMethod, error)
	CreatePaymentMethod(ctx context.Context, name string) (*domain.PaymentMethod, error)
	TogglePaymentMethod(ctx context.Context, id string, isActive bool) error
}

type InventoryRepository struct {
	Db *pgxpool.Pool
}

func NewInventoryRepository(Db *pgxpool.Pool) IInventoryRepository {
	return &InventoryRepository{Db: Db}
}

func (r *InventoryRepository) CreateProduct(ctx context.Context, p domain.Product) (*domain.Product, error) {
	query := `INSERT INTO inventory_products (name, sku, description, price, quantity, threshold, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.Db.QueryRow(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *InventoryRepository) UpdateProduct(ctx context.Context, id string, p domain.Product) (*domain.Product, error) {
	query := `UPDATE inventory_products
		SET name = $1, sku = $2, description = $3, price = $4, quantity = $5, threshold = $6, is_active = $7, updated_at = NOW()
		WHERE id = $8
		RETURNING id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var updated domain.Product
	err := r.Db.QueryRow(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive, id).Scan(
		&updated.ID, &updated.Name, &updated.SKU, &updated.Description, &updated.Price,
		&updated.Quantity, &updated.Threshold, &updated.IsActive, &updated.CreatedAt, &updated.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}
	return &updated, nil
}

func (r *InventoryRepository) DeleteProduct(ctx context.Context, id string) error {
	query := `DELETE FROM inventory_products WHERE id = $1`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.Db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

func (r *InventoryRepository) GetProduct(ctx context.Context, id string) (*domain.Product, error) {
	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at 
		FROM inventory_products WHERE id = $1`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var p domain.Product
	err := r.Db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price,
		&p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *InventoryRepository) ListProducts(ctx context.Context, page, limit int, search string, activeOnly bool) ([]domain.Product, int, error) {
	offset := (page - 1) * limit
	args := []interface{}{}
	argIndex := 1

	baseQuery := `FROM inventory_products WHERE 1=1`

	if search != "" {
		baseQuery += ` AND (name ILIKE $` + fmt.Sprint(argIndex) + ` OR sku ILIKE $` + fmt.Sprint(argIndex) + `)`
		args = append(args, "%"+search+"%")
		argIndex++
	}

	if activeOnly {
		baseQuery += ` AND is_active = true`
	}

	countQuery := `SELECT COUNT(*) ` + baseQuery
	var total int
	err := r.Db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at ` + baseQuery +
		` ORDER BY name ASC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)

	args = append(args, limit, offset)

	rows, err := r.Db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	return products, total, nil
}

func (r *InventoryRepository) GetLowStockProducts(ctx context.Context) ([]domain.Product, error) {
	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at 
		FROM inventory_products WHERE is_active = true AND quantity <= threshold ORDER BY quantity ASC`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, nil
}

func (r *InventoryRepository) LogSale(ctx context.Context, sale domain.Sale) (*domain.Sale, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Verify quantity & lock row
	var currentQty int
	var price float64
	err = tx.QueryRow(ctx, `SELECT quantity, price FROM inventory_products WHERE id = $1 FOR UPDATE`, sale.ProductID).Scan(&currentQty, &price)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}

	if currentQty < sale.QuantitySold {
		return nil, errors.New("insufficient stock")
	}

	// Decrement quantity
	_, err = tx.Exec(ctx, `UPDATE inventory_products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, sale.QuantitySold, sale.ProductID)
	if err != nil {
		return nil, err
	}

	// Insert sale record with price snapshot
	sale.UnitPrice = price
	err = tx.QueryRow(ctx, `
		INSERT INTO inventory_sales (product_id, seller_id, quantity_sold, unit_price, payment_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, total_amount, sold_at`,
		sale.ProductID, sale.SellerID, sale.QuantitySold, sale.UnitPrice, sale.PaymentMethod, sale.Notes).Scan(&sale.ID, &sale.TotalAmount, &sale.SoldAt)

	if err != nil {
		return nil, err
	}

	var sellerName string
	err = tx.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1`, sale.SellerID).Scan(&sellerName)
	if err == nil {
		sale.SellerName = sellerName
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &sale, nil
}

func (r *InventoryRepository) ListSales(ctx context.Context, page, limit int, productID, sellerID *string, fromDate, toDate *time.Time) ([]domain.Sale, int, error) {
	offset := (page - 1) * limit
	args := []interface{}{}
	argIndex := 1

	baseQuery := `FROM inventory_sales s 
		JOIN users u ON s.seller_id = u.id 
		JOIN inventory_products p ON s.product_id = p.id
		WHERE 1=1`

	if productID != nil && *productID != "" {
		baseQuery += ` AND s.product_id = $` + fmt.Sprint(argIndex)
		args = append(args, *productID)
		argIndex++
	}

	if sellerID != nil && *sellerID != "" {
		baseQuery += ` AND s.seller_id = $` + fmt.Sprint(argIndex)
		args = append(args, *sellerID)
		argIndex++
	}

	if fromDate != nil {
		baseQuery += ` AND s.sold_at >= $` + fmt.Sprint(argIndex)
		args = append(args, *fromDate)
		argIndex++
	}

	if toDate != nil {
		baseQuery += ` AND s.sold_at <= $` + fmt.Sprint(argIndex)
		args = append(args, *toDate)
		argIndex++
	}

	countQuery := `SELECT COUNT(*) ` + baseQuery
	var total int
	err := r.Db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT s.id, s.product_id, p.name as product_name, s.seller_id, u.full_name as seller_name, 
		s.quantity_sold, s.unit_price, s.total_amount, s.payment_method, s.notes, s.sold_at ` + baseQuery +
		` ORDER BY s.sold_at DESC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)

	args = append(args, limit, offset)

	rows, err := r.Db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sales []domain.Sale
	for rows.Next() {
		var s domain.Sale
		if err := rows.Scan(&s.ID, &s.ProductID, &s.ProductName, &s.SellerID, &s.SellerName, &s.QuantitySold, &s.UnitPrice, &s.TotalAmount, &s.PaymentMethod, &s.Notes, &s.SoldAt); err != nil {
			return nil, 0, err
		}
		sales = append(sales, s)
	}
	return sales, total, nil
}



// In the repository, we'll return a raw version and let the service format it.
type SalesReportData struct {
	TotalRevenue float64
	TotalUnits   int
	ByProduct    []struct{
		ProductID string
		Name string
		Units int
		Revenue float64
	}
	BySeller     []struct{
		SellerID string
		Name string
		Units int
		Revenue float64
	}
	ByPaymentMethod []struct {
		PaymentMethod string
		Revenue       float64
	}
}

func (r *InventoryRepository) GetRawSalesReport(ctx context.Context, fromDate, toDate time.Time) (*SalesReportData, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	report := &SalesReportData{}

	// Totals
	err := r.Db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(quantity_sold), 0)
		FROM inventory_sales
		WHERE sold_at >= $1 AND sold_at <= $2`, fromDate, toDate).Scan(&report.TotalRevenue, &report.TotalUnits)
	if err != nil {
		return nil, err
	}

	// By Product
	productRows, err := r.Db.Query(ctx, `
		SELECT s.product_id, p.name, SUM(s.quantity_sold) as units, SUM(s.total_amount) as revenue
		FROM inventory_sales s JOIN inventory_products p ON s.product_id = p.id
		WHERE s.sold_at >= $1 AND s.sold_at <= $2
		GROUP BY s.product_id, p.name ORDER BY revenue DESC`, fromDate, toDate)
	if err == nil {
		defer productRows.Close()
		for productRows.Next() {
			var p struct{ ProductID string; Name string; Units int; Revenue float64 }
			productRows.Scan(&p.ProductID, &p.Name, &p.Units, &p.Revenue)
			report.ByProduct = append(report.ByProduct, p)
		}
	}

	// By Seller
	sellerRows, err := r.Db.Query(ctx, `
		SELECT s.seller_id, u.full_name, SUM(s.quantity_sold) as units, SUM(s.total_amount) as revenue
		FROM inventory_sales s JOIN users u ON s.seller_id = u.id
		WHERE s.sold_at >= $1 AND s.sold_at <= $2
		GROUP BY s.seller_id, u.full_name ORDER BY revenue DESC`, fromDate, toDate)
	if err == nil {
		defer sellerRows.Close()
		for sellerRows.Next() {
			var s struct{ SellerID string; Name string; Units int; Revenue float64 }
			sellerRows.Scan(&s.SellerID, &s.Name, &s.Units, &s.Revenue)
			report.BySeller = append(report.BySeller, s)
		}
	}

	// By Payment Method
	pmRows, err := r.Db.Query(ctx, `
		SELECT s.payment_method, SUM(s.total_amount) as revenue
		FROM inventory_sales s
		WHERE s.sold_at >= $1 AND s.sold_at <= $2
		GROUP BY s.payment_method ORDER BY revenue DESC`, fromDate, toDate)
	if err == nil {
		defer pmRows.Close()
		for pmRows.Next() {
			var p struct{ PaymentMethod string; Revenue float64 }
			pmRows.Scan(&p.PaymentMethod, &p.Revenue)
			report.ByPaymentMethod = append(report.ByPaymentMethod, p)
		}
	}

	return report, nil
}

func (r *InventoryRepository) ListPaymentMethods(ctx context.Context, activeOnly bool) ([]domain.PaymentMethod, error) {
	query := `SELECT id, name, is_active, created_at, updated_at FROM inventory_payment_methods WHERE 1=1`
	if activeOnly {
		query += ` AND is_active = true`
	}
	query += ` ORDER BY name ASC`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []domain.PaymentMethod
	for rows.Next() {
		var m domain.PaymentMethod
		if err := rows.Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		methods = append(methods, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return methods, nil
}

func (r *InventoryRepository) CreatePaymentMethod(ctx context.Context, name string) (*domain.PaymentMethod, error) {
	query := `INSERT INTO inventory_payment_methods (name) VALUES ($1) RETURNING id, name, is_active, created_at, updated_at`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var m domain.PaymentMethod
	err := r.Db.QueryRow(ctx, query, name).Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *InventoryRepository) TogglePaymentMethod(ctx context.Context, id string, isActive bool) error {
	query := `UPDATE inventory_payment_methods SET is_active = $1, updated_at = NOW() WHERE id = $2`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.Db.Exec(ctx, query, isActive, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}
