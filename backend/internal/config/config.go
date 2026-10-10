// ministack-backend/internal/config/config.go
package config

import "os"

type Config struct {
	Port         string
	MinistackURL string
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "9091"),
		MinistackURL: getEnv("MINISTACK_URL", "http://localhost:4566"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
