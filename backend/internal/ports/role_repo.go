package ports

import (
	"context"
	"errors"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IRoleRepository interface {
	// ListRoles returns every role with its permissions and how many users hold it.
	ListRoles(ctx context.Context) ([]domain.Role, error)
	// LoadAllPermissions is the single read the access cache is built from.
	LoadAllPermissions(ctx context.Context) (map[string]map[string]domain.AccessLevel, error)
	// LoadRoleNames maps role key -> display name, for the same cache.
	LoadRoleNames(ctx context.Context) (map[string]string, error)
	GetRole(ctx context.Context, key string) (*domain.Role, error)
	RoleExists(ctx context.Context, key string) (bool, error)
	CreateRole(ctx context.Context, role domain.Role) error
	// UpdateRole replaces the role's name, description and whole permission set.
	UpdateRole(ctx context.Context, role domain.Role) error
	DeleteRole(ctx context.Context, key string) error
	// RolesWithFullAccess lists the roles that hold feature at full level.
	RolesWithFullAccess(ctx context.Context, feature string) ([]string, error)
}

type RoleRepository struct {
	Db *pgxpool.Pool
}

func NewRoleRepository(Db *pgxpool.Pool) IRoleRepository {
	return &RoleRepository{Db: Db}
}

func (r *RoleRepository) ListRoles(ctx context.Context) ([]domain.Role, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx, `
		SELECT r.key, r.name, r.description, r.is_system, r.created_at, r.updated_at,
		       (SELECT COUNT(*) FROM users u WHERE u.role = r.key)
		FROM roles r
		ORDER BY r.is_system DESC, r.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.Role
	index := map[string]int{}
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role.Key, &role.Name, &role.Description, &role.IsSystem,
			&role.CreatedAt, &role.UpdatedAt, &role.UserCount); err != nil {
			return nil, err
		}
		role.Permissions = map[string]domain.AccessLevel{}
		index[role.Key] = len(roles)
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	perms, err := r.LoadAllPermissions(ctx)
	if err != nil {
		return nil, err
	}
	for key, p := range perms {
		if i, ok := index[key]; ok {
			roles[i].Permissions = p
		}
	}
	return roles, nil
}

func (r *RoleRepository) LoadAllPermissions(ctx context.Context) (map[string]map[string]domain.AccessLevel, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx, `SELECT role_key, feature, level FROM role_permissions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]map[string]domain.AccessLevel{}
	for rows.Next() {
		var role, feature, level string
		if err := rows.Scan(&role, &feature, &level); err != nil {
			return nil, err
		}
		if out[role] == nil {
			out[role] = map[string]domain.AccessLevel{}
		}
		out[role][feature] = domain.AccessLevel(level)
	}
	return out, rows.Err()
}

func (r *RoleRepository) LoadRoleNames(ctx context.Context) (map[string]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx, `SELECT key, name FROM roles`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]string{}
	for rows.Next() {
		var key, name string
		if err := rows.Scan(&key, &name); err != nil {
			return nil, err
		}
		out[key] = name
	}
	return out, rows.Err()
}

func (r *RoleRepository) GetRole(ctx context.Context, key string) (*domain.Role, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var role domain.Role
	err := r.Db.QueryRow(ctx, `
		SELECT r.key, r.name, r.description, r.is_system, r.created_at, r.updated_at,
		       (SELECT COUNT(*) FROM users u WHERE u.role = r.key)
		FROM roles r WHERE r.key = $1`, key).Scan(
		&role.Key, &role.Name, &role.Description, &role.IsSystem,
		&role.CreatedAt, &role.UpdatedAt, &role.UserCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrRoleNotFound
		}
		return nil, err
	}

	role.Permissions = map[string]domain.AccessLevel{}
	rows, err := r.Db.Query(ctx, `SELECT feature, level FROM role_permissions WHERE role_key = $1`, key)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var feature, level string
		if err := rows.Scan(&feature, &level); err != nil {
			return nil, err
		}
		role.Permissions[feature] = domain.AccessLevel(level)
	}
	return &role, rows.Err()
}

func (r *RoleRepository) RoleExists(ctx context.Context, key string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var exists bool
	err := r.Db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM roles WHERE key = $1)`, key).Scan(&exists)
	return exists, err
}

func (r *RoleRepository) CreateRole(ctx context.Context, role domain.Role) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO roles (key, name, description, is_system) VALUES ($1, $2, $3, FALSE)`,
		role.Key, role.Name, role.Description); err != nil {
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateRole
		}
		return err
	}
	if err := writePermissions(ctx, tx, role.Key, role.Permissions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoleRepository) UpdateRole(ctx context.Context, role domain.Role) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.Db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE roles SET name = $2, description = $3, updated_at = NOW() WHERE key = $1`,
		role.Key, role.Name, role.Description)
	if err != nil {
		if isUniqueViolation(err) {
			return appErrors.ErrDuplicateRole
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrRoleNotFound
	}

	if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_key = $1`, role.Key); err != nil {
		return err
	}
	if err := writePermissions(ctx, tx, role.Key, role.Permissions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoleRepository) DeleteRole(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// The users.role foreign key refuses this while anyone still holds the role,
	// but checking first lets us say so in plain words and not as a constraint name.
	var inUse bool
	if err := r.Db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE role = $1)`, key).Scan(&inUse); err != nil {
		return err
	}
	if inUse {
		return appErrors.ErrRoleInUse
	}

	tag, err := r.Db.Exec(ctx, `DELETE FROM roles WHERE key = $1 AND is_system = FALSE`, key)
	if err != nil {
		if isForeignKeyViolation(err) {
			return appErrors.ErrRoleInUse
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return appErrors.ErrRoleNotFound
	}
	return nil
}

func (r *RoleRepository) RolesWithFullAccess(ctx context.Context, feature string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.Db.Query(ctx,
		`SELECT role_key FROM role_permissions WHERE feature = $1 AND level = 'full'`, feature)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func writePermissions(ctx context.Context, tx pgx.Tx, roleKey string, perms map[string]domain.AccessLevel) error {
	for feature, level := range perms {
		if !level.Valid() {
			continue
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO role_permissions (role_key, feature, level) VALUES ($1, $2, $3)`,
			roleKey, feature, string(level)); err != nil {
			return err
		}
	}
	return nil
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
