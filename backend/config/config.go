package config

type Config struct {
	Port  int
	Env   string
	Token struct {
		TokenKey             string
		AccessTokenDuration  string
		RefreshTokenDuration string
	}
	Db struct {
		Dsn          string
		MaxOpenConns int
		MaxIdleConns int
		MaxIdleTime  string
	}
	Limiter struct {
		Rps     float64
		Burst   int
		Enabled bool
	}
	Cors struct {
		TrustedOrigins []string
	}
}
