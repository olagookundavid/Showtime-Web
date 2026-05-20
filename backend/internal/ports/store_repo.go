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
	SaveProductVariants(ctx context.Context, productID string, variants []domain.ProductVariant) error
	SaveProductImages(ctx context.Context, productID string, images []domain.ProductImage) error

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

func (r *StoreRepository) ListStoreProducts(ctx context.Context) ([]domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at 
		FROM store_products 
		WHERE is_active = true 
		ORDER BY name ASC`

	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	// Fetch primary images and variants for each product
	for i := range products {
		imagesQuery := `SELECT id, product_id, image_url, is_primary, display_order, created_at 
			FROM store_product_images 
			WHERE product_id = $1 
			ORDER BY display_order ASC`
		imgRows, err := r.Db.Query(ctx, imagesQuery, products[i].ID)
		if err == nil {
			var images []domain.ProductImage
			for imgRows.Next() {
				var img domain.ProductImage
				if err := imgRows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.DisplayOrder, &img.CreatedAt); err == nil {
					images = append(images, img)
				}
			}
			imgRows.Close()
			products[i].Images = images
		}

		variantsQuery := `SELECT id, product_id, variant_name, variant_value, sku, price, quantity, created_at, updated_at 
			FROM store_product_variants 
			WHERE product_id = $1 
			ORDER BY variant_name ASC, variant_value ASC`
		vRows, err := r.Db.Query(ctx, variantsQuery, products[i].ID)
		if err == nil {
			var variants []domain.ProductVariant
			for vRows.Next() {
				var v domain.ProductVariant
				if err := vRows.Scan(&v.ID, &v.ProductID, &v.VariantName, &v.VariantValue, &v.SKU, &v.Price, &v.Quantity, &v.CreatedAt, &v.UpdatedAt); err == nil {
					variants = append(variants, v)
				}
			}
			vRows.Close()
			products[i].Variants = variants
		}
	}

	return products, nil
}

func (r *StoreRepository) GetStoreProduct(ctx context.Context, id string) (*domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at 
		FROM store_products 
		WHERE id = $1`

	var p domain.Product
	err := r.Db.QueryRow(ctx, query, id).Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrNotFound
		}
		return nil, err
	}

	// Fetch all relational images
	imagesQuery := `SELECT id, product_id, image_url, is_primary, display_order, created_at 
		FROM store_product_images 
		WHERE product_id = $1 
		ORDER BY display_order ASC`
	imgRows, err := r.Db.Query(ctx, imagesQuery, p.ID)
	if err == nil {
		defer imgRows.Close()
		var images []domain.ProductImage
		for imgRows.Next() {
			var img domain.ProductImage
			if err := imgRows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.DisplayOrder, &img.CreatedAt); err == nil {
				images = append(images, img)
			}
		}
		p.Images = images
	}

	// Fetch all relational variants
	variantsQuery := `SELECT id, product_id, variant_name, variant_value, sku, price, quantity, created_at, updated_at 
		FROM store_product_variants 
		WHERE product_id = $1 
		ORDER BY variant_name ASC, variant_value ASC`
	vRows, err := r.Db.Query(ctx, variantsQuery, p.ID)
	if err == nil {
		defer vRows.Close()
		var variants []domain.ProductVariant
		for vRows.Next() {
			var v domain.ProductVariant
			if err := vRows.Scan(&v.ID, &v.ProductID, &v.VariantName, &v.VariantValue, &v.SKU, &v.Price, &v.Quantity, &v.CreatedAt, &v.UpdatedAt); err == nil {
				variants = append(variants, v)
			}
		}
		p.Variants = variants
	}

	return &p, nil
}

func (r *StoreRepository) CreateOrder(ctx context.Context, order domain.Order) (*domain.Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

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
				order_id, product_id, variant_id, quantity, unit_price
			) VALUES ($1, $2, $3, $4, $5)
			RETURNING id`
		err = tx.QueryRow(ctx, itemQuery,
			order.ID, order.Items[i].ProductID, order.Items[i].VariantID, order.Items[i].Quantity, order.Items[i].UnitPrice,
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

	itemsQuery := `SELECT i.id, i.order_id, i.product_id, p.name as product_name, i.variant_id, 
		COALESCE(v.variant_name, '') as variant_name, COALESCE(v.variant_value, '') as variant_value,
		i.quantity, i.unit_price 
		FROM online_order_items i
		JOIN store_products p ON i.product_id = p.id
		LEFT JOIN store_product_variants v ON i.variant_id = v.id
		WHERE i.order_id = $1`

	rows, err := r.Db.Query(ctx, itemsQuery, o.ID)
	if err == nil {
		defer rows.Close()
		var items []domain.OrderItem
		for rows.Next() {
			var item domain.OrderItem
			err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.VariantID, &item.VariantName, &item.VariantValue, &item.Quantity, &item.UnitPrice)
			if err == nil {
				items = append(items, item)
			}
		}
		o.Items = items
	}

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

	itemsQuery := `SELECT i.id, i.order_id, i.product_id, p.name as product_name, i.variant_id, 
		COALESCE(v.variant_name, '') as variant_name, COALESCE(v.variant_value, '') as variant_value,
		i.quantity, i.unit_price 
		FROM online_order_items i
		JOIN store_products p ON i.product_id = p.id
		LEFT JOIN store_product_variants v ON i.variant_id = v.id
		WHERE i.order_id = $1`

	rows, err := r.Db.Query(ctx, itemsQuery, o.ID)
	if err == nil {
		defer rows.Close()
		var items []domain.OrderItem
		for rows.Next() {
			var item domain.OrderItem
			err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.VariantID, &item.VariantName, &item.VariantValue, &item.Quantity, &item.UnitPrice)
			if err == nil {
				items = append(items, item)
			}
		}
		o.Items = items
	}

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

	itemsQuery := `SELECT i.id, i.order_id, i.product_id, p.name as product_name, i.variant_id, 
		COALESCE(v.variant_name, '') as variant_name, COALESCE(v.variant_value, '') as variant_value,
		i.quantity, i.unit_price 
		FROM online_order_items i
		JOIN store_products p ON i.product_id = p.id
		LEFT JOIN store_product_variants v ON i.variant_id = v.id
		WHERE i.order_id = $1`

	rows, err := r.Db.Query(ctx, itemsQuery, o.ID)
	if err == nil {
		defer rows.Close()
		var items []domain.OrderItem
		for rows.Next() {
			var item domain.OrderItem
			err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.VariantID, &item.VariantName, &item.VariantValue, &item.Quantity, &item.UnitPrice)
			if err == nil {
				items = append(items, item)
			}
		}
		o.Items = items
	}

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

	// 1. Delete existing variants for this product
	_, err = tx.Exec(ctx, `DELETE FROM store_product_variants WHERE product_id = $1`, productID)
	if err != nil {
		return err
	}

	// 2. Insert new variants
	for _, v := range variants {
		query := `
			INSERT INTO store_product_variants (
				product_id, variant_name, variant_value, sku, price, quantity, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`
		
		var priceVal interface{}
		if v.Price != nil {
			priceVal = *v.Price
		}
		
		_, err = tx.Exec(ctx, query, productID, v.VariantName, v.VariantValue, v.SKU, priceVal, v.Quantity)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
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

// Admin product catalog actions specifically for store_products
func (r *StoreRepository) CreateStoreProduct(ctx context.Context, p domain.Product) (*domain.Product, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO store_products (
			name, sku, description, price, quantity, threshold, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, created_at, updated_at`

	err := r.Db.QueryRow(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *StoreRepository) UpdateStoreProduct(ctx context.Context, p domain.Product) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		UPDATE store_products 
		SET name = $1, sku = $2, description = $3, price = $4, quantity = $5, threshold = $6, is_active = $7, updated_at = NOW() 
		WHERE id = $8`

	tag, err := r.Db.Exec(ctx, query, p.Name, p.SKU, p.Description, p.Price, p.Quantity, p.Threshold, p.IsActive, p.ID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrNotFound
	}
	return nil
}

func (r *StoreRepository) DeleteStoreProduct(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `DELETE FROM store_products WHERE id = $1`
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

	query := `SELECT id, name, sku, description, price, quantity, threshold, is_active, created_at, updated_at 
		FROM store_products 
		ORDER BY name ASC`

	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Quantity, &p.Threshold, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	// Fetch primary images and variants for each product
	for i := range products {
		imagesQuery := `SELECT id, product_id, image_url, is_primary, display_order, created_at 
			FROM store_product_images 
			WHERE product_id = $1 
			ORDER BY display_order ASC`
		imgRows, err := r.Db.Query(ctx, imagesQuery, products[i].ID)
		if err == nil {
			var images []domain.ProductImage
			for imgRows.Next() {
				var img domain.ProductImage
				if err := imgRows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.IsPrimary, &img.DisplayOrder, &img.CreatedAt); err == nil {
					images = append(images, img)
				}
			}
			imgRows.Close()
			products[i].Images = images
		}

		variantsQuery := `SELECT id, product_id, variant_name, variant_value, sku, price, quantity, created_at, updated_at 
			FROM store_product_variants 
			WHERE product_id = $1 
			ORDER BY variant_name ASC, variant_value ASC`
		vRows, err := r.Db.Query(ctx, variantsQuery, products[i].ID)
		if err == nil {
			var variants []domain.ProductVariant
			for vRows.Next() {
				var v domain.ProductVariant
				if err := vRows.Scan(&v.ID, &v.ProductID, &v.VariantName, &v.VariantValue, &v.SKU, &v.Price, &v.Quantity, &v.CreatedAt, &v.UpdatedAt); err == nil {
					variants = append(variants, v)
				}
			}
			vRows.Close()
			products[i].Variants = variants
		}
	}

	return products, nil
}
