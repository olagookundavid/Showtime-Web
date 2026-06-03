package ports

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IStoreRepository interface {
	ListStoreProducts(ctx context.Context) ([]domain.Product, error)
	GetStoreProduct(ctx context.Context, id string) (*domain.Product, error)
	CreateOrder(ctx context.Context, order domain.Order) (*domain.Order, error)
	GetOrder(ctx context.Context, id string) (*domain.Order, error)
	GetOrderByReference(ctx context.Context, reference string) (*domain.Order, error)
	GetOrderByPaystackRef(ctx context.Context, paystackRef string) (*domain.Order, error)
	UpdateOrderPaymentStatus(ctx context.Context, id string, status string) error
	UpdateOrderFulfillmentStatus(ctx context.Context, id string, status string) error
	ListOrders(ctx context.Context, page, limit int, userID *string, paymentStatus *string, fulfillmentStatus *string) ([]domain.Order, int, error)
	SaveAddress(ctx context.Context, address domain.SavedAddress) (*domain.SavedAddress, error)
	ListSavedAddresses(ctx context.Context, userID string) ([]domain.SavedAddress, error)
	DeductStock(ctx context.Context, productID string, variantID *string, qty int) error
	MarkOrderFailedAndRestoreStock(ctx context.Context, orderID string) error
	CancelOrderAndRestoreStock(ctx context.Context, orderID string) error
	SaveProductVariants(ctx context.Context, productID string, variants []domain.ProductVariant) error
	SaveProductImages(ctx context.Context, productID string, images []domain.ProductImage) error
	ClearVariantImagePins(ctx context.Context, productID string, urls []string) error

	// Reviews
	FindPaidOrderForProduct(ctx context.Context, userID, productID string) (*string, error)
	UpsertProductReview(ctx context.Context, review domain.ProductReview) (*domain.ProductReview, error)
	ListProductReviews(ctx context.Context, productID string, page, limit int, sort string) ([]domain.ProductReview, int, error)
	GetProductReview(ctx context.Context, id string) (*domain.ProductReview, error)
	GetUserReviewForProduct(ctx context.Context, userID, productID string) (*domain.ProductReview, error)
	DeleteProductReview(ctx context.Context, id string) error
	RecomputeProductRating(ctx context.Context, productID string) error

	// Admin e-commerce product catalog CRUD operations
	CreateStoreProduct(ctx context.Context, product domain.Product) (*domain.Product, error)
	UpdateStoreProduct(ctx context.Context, product domain.Product) error
	DeleteStoreProduct(ctx context.Context, id string) error
	ListAllStoreProducts(ctx context.Context) ([]domain.Product, error)
}

type StoreRepository struct {
	Db *pgxpool.Pool
}

func NewStoreRepository(Db *pgxpool.Pool) IStoreRepository {
	return &StoreRepository{Db: Db}
}

// scanProductRow scans a single product row (columns in canonical order, with
// options JSONB, rating summary, and creator info last). Reused by all the
// list/get paths.
func scanProductRow(row pgx.Row, p *domain.Product) error {
	var optionsRaw []byte
	var createdBy *string
	var createdByName string
	if err := row.Scan(
		&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold,
		&p.IsActive, &p.CreatedAt, &p.UpdatedAt, &optionsRaw, &p.RatingAvg, &p.RatingCount,
		&createdBy, &createdByName,
	); err != nil {
		return err
	}
	if len(optionsRaw) > 0 {
		_ = json.Unmarshal(optionsRaw, &p.Options)
	}
	p.CreatedBy = createdBy
	p.CreatedByName = createdByName
	return nil
}

// loadProductRelations attaches Images and Variants for a single product.
// Errors fetching relations are not fatal — the product itself is still
// returned with empty slices, matching prior behaviour.
func (r *StoreRepository) loadProductRelations(ctx context.Context, p *domain.Product) {
	imagesQuery := `SELECT id, product_id, image_url, is_primary, display_order, created_at
		FROM store_product_images WHERE product_id = $1 ORDER BY display_order ASC`
	if imgRows, err := r.Db.Query(ctx, imagesQuery, p.ID); err == nil {
		var images []domain.ProductImage
		for imgRows.Next() {
			var img domain.ProductImage
			if err := imgRows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.DisplayOrder, &img.CreatedAt); err == nil {
				images = append(images, img)
			}
		}
		imgRows.Close()
		p.Images = images
	}

	variantsQuery := `SELECT id, product_id,
		COALESCE(option1_value, ''), COALESCE(option2_value, ''), COALESCE(option3_value, ''),
		COALESCE(sku, ''), quantity, COALESCE(image_url, ''), created_at, updated_at
		FROM store_product_variants WHERE product_id = $1
		ORDER BY option1_value ASC NULLS FIRST, option2_value ASC NULLS FIRST, option3_value ASC NULLS FIRST`
	if vRows, err := r.Db.Query(ctx, variantsQuery, p.ID); err == nil {
		var variants []domain.ProductVariant
		for vRows.Next() {
			var v domain.ProductVariant
			if err := vRows.Scan(&v.ID, &v.ProductID, &v.Option1Value, &v.Option2Value, &v.Option3Value, &v.SKU, &v.Quantity, &v.ImageURL, &v.CreatedAt, &v.UpdatedAt); err == nil {
				variants = append(variants, v)
			}
		}
		vRows.Close()
		p.Variants = variants
	}
}

// Bare table columns. List/get queries wrap this with a LEFT JOIN to users
// to attach the creator's display name (productSelectFrom).
const productSelectColumns = `sp.id, sp.name, sp.sku, sp.description, sp.price, sp.quantity, sp.threshold, sp.is_active, sp.created_at, sp.updated_at, sp.options, sp.rating_avg, sp.rating_count, sp.created_by, COALESCE(u.full_name, '')`

const productSelectFrom = `FROM store_products sp LEFT JOIN users u ON u.id = sp.created_by`

// loadOrderItems fetches the line items for an order, joining only to the
// product table for the product_name. The variant_label is read directly from
// the order_items snapshot column so receipts survive variant edits/deletes.
func (r *StoreRepository) loadOrderItems(ctx context.Context, orderID string) []domain.OrderItem {
	itemsQuery := `SELECT i.id, i.order_id, i.product_id, p.name AS product_name,
		i.variant_id, COALESCE(i.variant_label, '') AS variant_label,
		i.quantity, i.unit_price
		FROM online_order_items i
		JOIN store_products p ON i.product_id = p.id
		WHERE i.order_id = $1`
	rows, err := r.Db.Query(ctx, itemsQuery, orderID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var items []domain.OrderItem
	for rows.Next() {
		var item domain.OrderItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.VariantID, &item.VariantLabel, &item.Quantity, &item.UnitPrice); err == nil {
			items = append(items, item)
		}
	}
	return items
}

func (r *StoreRepository) ListStoreProducts(ctx context.Context) ([]domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	query := `SELECT ` + productSelectColumns + ` ` + productSelectFrom + ` WHERE sp.is_active = true ORDER BY sp.name ASC`
	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := scanProductRow(rows, &p); err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	for i := range products {
		r.loadProductRelations(ctx, &products[i])
	}
	return products, nil
}

func (r *StoreRepository) GetStoreProduct(ctx context.Context, id string) (*domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT ` + productSelectColumns + ` ` + productSelectFrom + ` WHERE sp.id = $1`
	var p domain.Product
	if err := scanProductRow(r.Db.QueryRow(ctx, query, id), &p); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}
	r.loadProductRelations(ctx, &p)
	return &p, nil
}

// CreateOrder atomically reserves stock for each item, then inserts the order
// and its line items in a single database transaction. Stock is locked with
// SELECT FOR UPDATE so concurrent checkouts cannot oversell. Any insufficient
// stock surfaces as appErrors.ErrInsufficientStock and the whole transaction
// rolls back, leaving stock untouched.
func (r *StoreRepository) CreateOrder(ctx context.Context, order domain.Order) (*domain.Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for i := range order.Items {
		item := order.Items[i]
		if item.VariantID != nil && *item.VariantID != "" {
			var currentQty int
			err = tx.QueryRow(ctx, `SELECT quantity FROM store_product_variants WHERE id = $1 FOR UPDATE`, *item.VariantID).Scan(&currentQty)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, appErrors.ErrVariantNotFound
				}
				return nil, err
			}
			if currentQty < item.Quantity {
				return nil, appErrors.ErrInsufficientStock
			}
			if _, err = tx.Exec(ctx, `UPDATE store_product_variants SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, item.Quantity, *item.VariantID); err != nil {
				return nil, err
			}
		} else {
			var currentQty int
			err = tx.QueryRow(ctx, `SELECT quantity FROM store_products WHERE id = $1 FOR UPDATE`, item.ProductID).Scan(&currentQty)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, appErrors.ErrNotFound
				}
				return nil, err
			}
			if currentQty < item.Quantity {
				return nil, appErrors.ErrInsufficientStock
			}
			if _, err = tx.Exec(ctx, `UPDATE store_products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, item.Quantity, item.ProductID); err != nil {
				return nil, err
			}
		}
	}

	orderQuery := `
		INSERT INTO online_orders (
			order_reference, user_id, customer_name, customer_email, customer_phone,
			shipping_country, shipping_state, shipping_city, shipping_address, shipping_postal_code,
			total_amount, payment_status, fulfillment_status, paystack_reference, paystack_access_code
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, orderQuery,
		order.OrderReference, order.UserID, order.CustomerName, order.CustomerEmail, order.CustomerPhone,
		order.ShippingCountry, order.ShippingState, order.ShippingCity, order.ShippingAddress, order.ShippingPostalCode,
		order.TotalAmount, order.PaymentStatus, order.FulfillmentStatus, order.PaystackReference, order.PaystackAccessCode,
	).Scan(&order.ID, &order.CreatedAt, &order.UpdatedAt)

	if err != nil {
		return nil, err
	}

	for i := range order.Items {
		itemQuery := `
			INSERT INTO online_order_items (
				order_id, product_id, variant_id, quantity, unit_price, variant_label
			) VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id`
		err = tx.QueryRow(ctx, itemQuery,
			order.ID, order.Items[i].ProductID, order.Items[i].VariantID, order.Items[i].Quantity, order.Items[i].UnitPrice, order.Items[i].VariantLabel,
		).Scan(&order.Items[i].ID)

		if err != nil {
			return nil, err
		}
		order.Items[i].OrderID = order.ID
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &order, nil
}

// restoreOrderStockTx adds reserved quantities back to variant/product stock
// inside an existing transaction. Used by failure/cancel paths.
func (r *StoreRepository) restoreOrderStockTx(ctx context.Context, tx pgx.Tx, orderID string) error {
	rows, err := tx.Query(ctx, `SELECT product_id, variant_id, quantity FROM online_order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return err
	}
	type item struct {
		productID string
		variantID *string
		quantity  int
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.productID, &it.variantID, &it.quantity); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()

	for _, it := range items {
		if it.variantID != nil && *it.variantID != "" {
			if _, err := tx.Exec(ctx, `UPDATE store_product_variants SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2`, it.quantity, *it.variantID); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, `UPDATE store_products SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2`, it.quantity, it.productID); err != nil {
				return err
			}
		}
	}
	return nil
}

// MarkOrderFailedAndRestoreStock transitions a pending order to failed and
// returns its reserved stock. Idempotent: if the order is no longer pending,
// it does nothing (so re-runs from verify retries or webhooks are safe).
func (r *StoreRepository) MarkOrderFailedAndRestoreStock(ctx context.Context, orderID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var paymentStatus string
	err = tx.QueryRow(ctx, `SELECT payment_status FROM online_orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&paymentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return appErrors.ErrNotFound
		}
		return err
	}
	if paymentStatus != "pending" {
		return tx.Commit(ctx)
	}

	if err := r.restoreOrderStockTx(ctx, tx, orderID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE online_orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`, orderID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CancelOrderAndRestoreStock marks an order's fulfillment as cancelled and
// returns its reserved stock. Idempotent: a second call is a no-op.
func (r *StoreRepository) CancelOrderAndRestoreStock(ctx context.Context, orderID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var fulfillmentStatus string
	err = tx.QueryRow(ctx, `SELECT fulfillment_status FROM online_orders WHERE id = $1 FOR UPDATE`, orderID).Scan(&fulfillmentStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return appErrors.ErrNotFound
		}
		return err
	}
	if fulfillmentStatus == "cancelled" {
		return tx.Commit(ctx)
	}

	if err := r.restoreOrderStockTx(ctx, tx, orderID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE online_orders SET fulfillment_status = 'cancelled', updated_at = NOW() WHERE id = $1`, orderID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *StoreRepository) GetOrder(ctx context.Context, id string) (*domain.Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT id, order_reference, user_id, customer_name, customer_email, customer_phone,
		shipping_country, shipping_state, shipping_city, shipping_address, shipping_postal_code,
		total_amount, payment_status, fulfillment_status, paystack_reference, paystack_access_code, created_at, updated_at
		FROM online_orders WHERE id = $1`

	var o domain.Order
	err := r.Db.QueryRow(ctx, query, id).Scan(
		&o.ID, &o.OrderReference, &o.UserID, &o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
		&o.ShippingCountry, &o.ShippingState, &o.ShippingCity, &o.ShippingAddress, &o.ShippingPostalCode,
		&o.TotalAmount, &o.PaymentStatus, &o.FulfillmentStatus, &o.PaystackReference, &o.PaystackAccessCode, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}

	o.Items = r.loadOrderItems(ctx, o.ID)

	return &o, nil
}

func (r *StoreRepository) GetOrderByReference(ctx context.Context, reference string) (*domain.Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT id, order_reference, user_id, customer_name, customer_email, customer_phone,
		shipping_country, shipping_state, shipping_city, shipping_address, shipping_postal_code,
		total_amount, payment_status, fulfillment_status, paystack_reference, paystack_access_code, created_at, updated_at
		FROM online_orders WHERE order_reference = $1 OR paystack_reference = $1`

	var o domain.Order
	err := r.Db.QueryRow(ctx, query, reference).Scan(
		&o.ID, &o.OrderReference, &o.UserID, &o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
		&o.ShippingCountry, &o.ShippingState, &o.ShippingCity, &o.ShippingAddress, &o.ShippingPostalCode,
		&o.TotalAmount, &o.PaymentStatus, &o.FulfillmentStatus, &o.PaystackReference, &o.PaystackAccessCode, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}

	o.Items = r.loadOrderItems(ctx, o.ID)

	return &o, nil
}

func (r *StoreRepository) GetOrderByPaystackRef(ctx context.Context, paystackRef string) (*domain.Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT id, order_reference, user_id, customer_name, customer_email, customer_phone,
		shipping_country, shipping_state, shipping_city, shipping_address, shipping_postal_code,
		total_amount, payment_status, fulfillment_status, paystack_reference, paystack_access_code, created_at, updated_at
		FROM online_orders WHERE paystack_reference = $1`

	var o domain.Order
	err := r.Db.QueryRow(ctx, query, paystackRef).Scan(
		&o.ID, &o.OrderReference, &o.UserID, &o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
		&o.ShippingCountry, &o.ShippingState, &o.ShippingCity, &o.ShippingAddress, &o.ShippingPostalCode,
		&o.TotalAmount, &o.PaymentStatus, &o.FulfillmentStatus, &o.PaystackReference, &o.PaystackAccessCode, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}

	o.Items = r.loadOrderItems(ctx, o.ID)

	return &o, nil
}

func (r *StoreRepository) UpdateOrderPaymentStatus(ctx context.Context, id string, status string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `UPDATE online_orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`
	tag, err := r.Db.Exec(ctx, query, status, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

func (r *StoreRepository) UpdateOrderFulfillmentStatus(ctx context.Context, id string, status string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `UPDATE online_orders SET fulfillment_status = $1, updated_at = NOW() WHERE id = $2`
	tag, err := r.Db.Exec(ctx, query, status, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

func (r *StoreRepository) ListOrders(ctx context.Context, page, limit int, userID *string, paymentStatus *string, fulfillmentStatus *string) ([]domain.Order, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	offset := (page - 1) * limit
	args := []interface{}{}
	argIndex := 1

	baseQuery := `FROM online_orders WHERE 1=1`

	if userID != nil && *userID != "" {
		baseQuery += ` AND user_id = $` + fmt.Sprint(argIndex)
		args = append(args, *userID)
		argIndex++
	}

	if paymentStatus != nil && *paymentStatus != "" {
		baseQuery += ` AND payment_status = $` + fmt.Sprint(argIndex)
		args = append(args, *paymentStatus)
		argIndex++
	}

	if fulfillmentStatus != nil && *fulfillmentStatus != "" {
		baseQuery += ` AND fulfillment_status = $` + fmt.Sprint(argIndex)
		args = append(args, *fulfillmentStatus)
		argIndex++
	}

	countQuery := `SELECT COUNT(*) ` + baseQuery
	var total int
	err := r.Db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT id, order_reference, user_id, customer_name, customer_email, customer_phone,
		shipping_country, shipping_state, shipping_city, shipping_address, shipping_postal_code,
		total_amount, payment_status, fulfillment_status, paystack_reference, paystack_access_code, created_at, updated_at ` + baseQuery +
		` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)

	args = append(args, limit, offset)

	rows, err := r.Db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []domain.Order
	for rows.Next() {
		var o domain.Order
		err := rows.Scan(
			&o.ID, &o.OrderReference, &o.UserID, &o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
			&o.ShippingCountry, &o.ShippingState, &o.ShippingCity, &o.ShippingAddress, &o.ShippingPostalCode,
			&o.TotalAmount, &o.PaymentStatus, &o.FulfillmentStatus, &o.PaystackReference, &o.PaystackAccessCode, &o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}

	return orders, total, nil
}

func (r *StoreRepository) SaveAddress(ctx context.Context, address domain.SavedAddress) (*domain.SavedAddress, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO user_saved_addresses (
			user_id, recipient_name, phone, country, state, city, street_address, postal_code
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	err := r.Db.QueryRow(ctx, query,
		address.UserID, address.RecipientName, address.Phone,
		address.Country, address.State, address.City, address.StreetAddress, address.PostalCode,
	).Scan(&address.ID, &address.CreatedAt)

	if err != nil {
		return nil, err
	}
	return &address, nil
}

func (r *StoreRepository) ListSavedAddresses(ctx context.Context, userID string) ([]domain.SavedAddress, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT id, user_id, recipient_name, phone, country, state, city, street_address, postal_code, created_at
		FROM user_saved_addresses WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := r.Db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.SavedAddress
	for rows.Next() {
		var addr domain.SavedAddress
		err := rows.Scan(&addr.ID, &addr.UserID, &addr.RecipientName, &addr.Phone, &addr.Country, &addr.State, &addr.City, &addr.StreetAddress, &addr.PostalCode, &addr.CreatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, addr)
	}
	return list, nil
}

func (r *StoreRepository) DeductStock(ctx context.Context, productID string, variantID *string, qty int) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// If variantID is provided, verify and deduct variant-specific stock count
	if variantID != nil && *variantID != "" {
		var currentVariantQty int
		err = tx.QueryRow(ctx, `SELECT quantity FROM store_product_variants WHERE id = $1 FOR UPDATE`, *variantID).Scan(&currentVariantQty)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errors.New("variant not found")
			}
			return err
		}

		if currentVariantQty < qty {
			return errors.New("insufficient variant stock")
		}

		_, err = tx.Exec(ctx, `UPDATE store_product_variants SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, qty, *variantID)
		if err != nil {
			return err
		}
	} else {
		// Fallback to global product inventory count
		var currentProductQty int
		err = tx.QueryRow(ctx, `SELECT quantity FROM store_products WHERE id = $1 FOR UPDATE`, productID).Scan(&currentProductQty)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errors.New("product not found")
			}
			return err
		}

		if currentProductQty < qty {
			return errors.New("insufficient global product stock")
		}

		_, err = tx.Exec(ctx, `UPDATE store_products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, qty, productID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *StoreRepository) SaveProductVariants(ctx context.Context, productID string, variants []domain.ProductVariant) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Replace-all semantics: drop the previous combination grid, then write
	// the new one. The unique (product, opt1, opt2, opt3) index will reject
	// duplicate combinations.
	_, err = tx.Exec(ctx, `DELETE FROM store_product_variants WHERE product_id = $1`, productID)
	if err != nil {
		return err
	}

	for _, v := range variants {
		query := `
			INSERT INTO store_product_variants (
				product_id, option1_value, option2_value, option3_value, sku, quantity, image_url, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`

		opt1 := nullableText(v.Option1Value)
		opt2 := nullableText(v.Option2Value)
		opt3 := nullableText(v.Option3Value)
		img := nullableText(v.ImageURL)

		_, err = tx.Exec(ctx, query, productID, opt1, opt2, opt3, v.SKU, v.Quantity, img)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// nullableText returns *string when s is non-empty, nil otherwise. Used so
// blank option columns persist as SQL NULL (matching the unique index intent).
func nullableText(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ClearVariantImagePins nulls out variant.image_url for any variant of the
// given product whose pinned image matches one of urls. Called after a product
// image is removed so variants don't carry a dangling URL.
func (r *StoreRepository) ClearVariantImagePins(ctx context.Context, productID string, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := r.Db.Exec(ctx,
		`UPDATE store_product_variants SET image_url = NULL, updated_at = NOW()
		 WHERE product_id = $1 AND image_url = ANY($2)`,
		productID, urls,
	)
	return err
}

func (r *StoreRepository) SaveProductImages(ctx context.Context, productID string, images []domain.ProductImage) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Delete existing images for this product
	_, err = tx.Exec(ctx, `DELETE FROM store_product_images WHERE product_id = $1`, productID)
	if err != nil {
		return err
	}

	// 2. Insert new images
	for _, img := range images {
		query := `
			INSERT INTO store_product_images (
				product_id, image_url, is_primary, display_order, created_at
			) VALUES ($1, $2, $3, $4, NOW())`
		
		_, err = tx.Exec(ctx, query, productID, img.ImageURL, img.IsPrimary, img.DisplayOrder)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// marshalOptions serializes the product's options array for JSONB storage.
// Returns a string (not []byte) because pgx encodes []byte as bytea, which
// Postgres rejects when the target column is JSONB. An empty/nil slice
// round-trips as the JSON literal "[]" so the NOT NULL default is honoured.
func marshalOptions(opts []domain.ProductOption) (string, error) {
	if opts == nil {
		return `[]`, nil
	}
	b, err := json.Marshal(opts)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Admin product catalog actions specifically for store_products
func (r *StoreRepository) CreateStoreProduct(ctx context.Context, p domain.Product) (*domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	optionsJSON, err := marshalOptions(p.Options)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO store_products (
			name, sku, description, price, quantity, threshold, is_active, options, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, created_at, updated_at`

	err = r.Db.QueryRow(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive, optionsJSON, p.CreatedBy).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *StoreRepository) UpdateStoreProduct(ctx context.Context, p domain.Product) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	optionsJSON, err := marshalOptions(p.Options)
	if err != nil {
		return err
	}

	query := `
		UPDATE store_products
		SET name = $1, sku = $2, description = $3, price = $4, quantity = $5, threshold = $6,
			is_active = $7, options = $8, updated_at = NOW()
		WHERE id = $9`

	tag, err := r.Db.Exec(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive, optionsJSON, p.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// DeleteStoreProduct soft-deletes by flipping is_active=false. A hard DELETE
// would break ON DELETE RESTRICT on online_order_items and erase the product
// name from historical receipts. The storefront list already filters by
// is_active so the product disappears for customers immediately.
func (r *StoreRepository) DeleteStoreProduct(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `UPDATE store_products SET is_active = false, updated_at = NOW() WHERE id = $1`
	tag, err := r.Db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

func (r *StoreRepository) ListAllStoreProducts(ctx context.Context) ([]domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	query := `SELECT ` + productSelectColumns + ` ` + productSelectFrom + ` ORDER BY sp.name ASC`
	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := scanProductRow(rows, &p); err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	for i := range products {
		r.loadProductRelations(ctx, &products[i])
	}
	return products, nil
}

// ─── Product reviews ──────────────────────────────────────────────────────

// FindPaidOrderForProduct returns the most recent paid order id that contained
// the product for this user, or nil if no such order exists. Used by the
// service layer to enforce "verified purchase" before allowing a review.
func (r *StoreRepository) FindPaidOrderForProduct(ctx context.Context, userID, productID string) (*string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT o.id FROM online_orders o
		JOIN online_order_items i ON i.order_id = o.id
		WHERE o.user_id = $1 AND i.product_id = $2 AND o.payment_status = 'paid'
		ORDER BY o.created_at DESC LIMIT 1`

	var id string
	err := r.Db.QueryRow(ctx, query, userID, productID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}

func scanReviewRow(row pgx.Row, rev *domain.ProductReview) error {
	var orderID *string
	if err := row.Scan(
		&rev.ID, &rev.ProductID, &rev.UserID, &orderID,
		&rev.Rating, &rev.Title, &rev.Body,
		&rev.CreatedAt, &rev.UpdatedAt,
		&rev.UserName,
	); err != nil {
		return err
	}
	rev.OrderID = orderID
	return nil
}

const reviewSelectColumns = `
	r.id, r.product_id, r.user_id, r.order_id,
	r.rating, r.title, r.body,
	r.created_at, r.updated_at,
	COALESCE(u.full_name, '')`

// UpsertProductReview creates or updates the (product, user) review row. The
// `ON CONFLICT` clause refreshes the rating/title/body and bumps updated_at
// but preserves the original order_id snapshot.
func (r *StoreRepository) UpsertProductReview(ctx context.Context, rev domain.ProductReview) (*domain.ProductReview, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO product_reviews (product_id, user_id, order_id, rating, title, body)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (product_id, user_id) DO UPDATE
		SET rating = EXCLUDED.rating,
		    title = EXCLUDED.title,
		    body = EXCLUDED.body,
		    updated_at = NOW()
		RETURNING id, created_at, updated_at`

	err := r.Db.QueryRow(ctx, query,
		rev.ProductID, rev.UserID, rev.OrderID, rev.Rating, rev.Title, rev.Body,
	).Scan(&rev.ID, &rev.CreatedAt, &rev.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &rev, nil
}

// ListProductReviews paginates reviews for a product. `sort` accepts
// "newest" (default), "highest", or "lowest". Returns the rows plus the
// total count for the matching product so the caller can render pagination.
func (r *StoreRepository) ListProductReviews(ctx context.Context, productID string, page, limit int, sort string) ([]domain.ProductReview, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	orderBy := "r.created_at DESC"
	switch sort {
	case "highest":
		orderBy = "r.rating DESC, r.created_at DESC"
	case "lowest":
		orderBy = "r.rating ASC, r.created_at DESC"
	}

	var total int
	if err := r.Db.QueryRow(ctx, `SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`, productID).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := `SELECT ` + reviewSelectColumns + `
		FROM product_reviews r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE r.product_id = $1
		ORDER BY ` + orderBy + `
		LIMIT $2 OFFSET $3`

	rows, err := r.Db.Query(ctx, query, productID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reviews []domain.ProductReview
	for rows.Next() {
		var rev domain.ProductReview
		if err := scanReviewRow(rows, &rev); err != nil {
			return nil, 0, err
		}
		reviews = append(reviews, rev)
	}
	return reviews, total, nil
}

// GetProductReview fetches a single review by id (used by admin delete).
func (r *StoreRepository) GetProductReview(ctx context.Context, id string) (*domain.ProductReview, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT ` + reviewSelectColumns + `
		FROM product_reviews r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE r.id = $1`

	var rev domain.ProductReview
	err := scanReviewRow(r.Db.QueryRow(ctx, query, id), &rev)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}
	return &rev, nil
}

// GetUserReviewForProduct lets the FE detect whether the current customer
// already has a review on this product (so the form pre-fills with edits
// instead of looking like a fresh submission).
func (r *StoreRepository) GetUserReviewForProduct(ctx context.Context, userID, productID string) (*domain.ProductReview, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT ` + reviewSelectColumns + `
		FROM product_reviews r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE r.user_id = $1 AND r.product_id = $2`

	var rev domain.ProductReview
	err := scanReviewRow(r.Db.QueryRow(ctx, query, userID, productID), &rev)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &rev, nil
}

func (r *StoreRepository) DeleteProductReview(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.Db.Exec(ctx, `DELETE FROM product_reviews WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

// RecomputeProductRating refreshes the denormalized rating_avg/rating_count
// on store_products in a single statement. Called by the service after every
// review create/update/delete so the aggregate stays in sync.
func (r *StoreRepository) RecomputeProductRating(ctx context.Context, productID string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		UPDATE store_products SET
			rating_avg = COALESCE((SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM product_reviews WHERE product_id = $1), 0),
			rating_count = COALESCE((SELECT COUNT(*) FROM product_reviews WHERE product_id = $1), 0),
			updated_at = NOW()
		WHERE id = $1`

	_, err := r.Db.Exec(ctx, query, productID)
	return err
}
