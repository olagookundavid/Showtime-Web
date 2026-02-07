package logger

import (
	"context"
	"fmt"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// log := GetSIngletonLogger()
const (
	// Context keys
	traceIDKey = "trace_id"
)

// Logger wraps zap logger with additional functionality
type Logger struct {
	zapLogger *zap.Logger
	ctx       context.Context
	traceID   string
}

// Options configures the logger
type Options struct {
	IsProduction bool
	AppName      string
	Environment  string
	TraceID      string
}

var (
	once     sync.Once
	instance *Logger
)

// NewLogger creates a new logger instance with options
func NewLogger(opts Options) (*Logger, error) {
	config := zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    "func",
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	var zapConfig zap.Config
	if opts.IsProduction {
		zapConfig = zap.NewProductionConfig()
		zapConfig.EncoderConfig = config
	} else {
		zapConfig = zap.NewDevelopmentConfig()
		zapConfig.EncoderConfig = config
		zapConfig.Development = true
		zapConfig.Encoding = "console"
	}

	// Set log level
	zapConfig.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)

	// Add common fields
	fields := []zap.Option{
		zap.Fields(
			zap.String("app", opts.AppName),
			zap.String("env", opts.Environment),
			zap.String("trace_id", opts.TraceID),
		),
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
	}

	logger, err := zapConfig.Build(fields...)
	if err != nil {
		return nil, err
	}

	return &Logger{
		zapLogger: logger,
		ctx:       context.Background(),
		traceID:   opts.TraceID,
	}, nil
}

func GetSingletonLogger() *Logger {
	return GetLogger(Options{})
}

// getFields extracts fields from context and merges with provided fields
func (l *Logger) getFields(fields map[string]interface{}) []zap.Field {
	zapFields := make([]zap.Field, 0, len(fields)+1)

	// Add trace ID from context if exists
	// if traceID := l.ctx.Value(traceIDKey); traceID != nil {
	// 	zapFields = append(zapFields, zap.String(traceIDKey, traceID.(string)))
	// }

	// Add provided fields
	for k, v := range fields {
		zapFields = append(zapFields, zap.Any(k, v))
	}

	return zapFields
}

// Log methods with proper levels and field handling
func (l *Logger) Info(msg string, fields map[string]interface{}) {
	l.zapLogger.Info(msg, l.getFields(fields)...)
}

func (l *Logger) Error(msg string, fields map[string]interface{}) {
	l.zapLogger.Error(msg, l.getFields(fields)...)
}

func (l *Logger) Fatal(msg string, fields map[string]interface{}) {
	l.zapLogger.Fatal(msg, l.getFields(fields)...)
}

func (l *Logger) Warn(msg string, fields map[string]interface{}) {
	l.zapLogger.Warn(msg, l.getFields(fields)...)
}

// GetLogger returns a singleton logger instance
func GetLogger(opts Options) *Logger {
	once.Do(func() {
		logger, err := NewLogger(opts)
		if err != nil {
			panic(err)
		}
		instance = logger
	})
	return instance
}

// Sync flushes any buffered log entries
func (l *Logger) Sync() error {
	return l.zapLogger.Sync()
}

// WithContext adds context to logger
func (l *Logger) WithContext(ctx context.Context) *Logger {
	return &Logger{
		zapLogger: l.zapLogger,
		ctx:       ctx,
	}
}

// InfoWriter returns an io.Writer that logs at Info level
func (l *Logger) InfoWriter() *LevelWriter {
	return &LevelWriter{logger: l, level: "info"}
}

// ErrorWriter returns an io.Writer that logs at Error level
func (l *Logger) ErrorWriter() *LevelWriter {
	return &LevelWriter{logger: l, level: "error"}
}

// LevelWriter implements io.Writer for different log levels
type LevelWriter struct {
	logger *Logger
	level  string
}

func (w *LevelWriter) Write(p []byte) (n int, err error) {
	msg := string(p)
	switch w.level {
	case "info":
		w.logger.Info(msg, map[string]interface{}{})
	case "error":
		w.logger.Error(msg, map[string]interface{}{})
	}
	return len(p), nil
}

func (l *Logger) Fatalf(format string, v ...interface{}) {
	l.Fatal(fmt.Sprint(format, v), nil)
}
func (l *Logger) Printf(format string, v ...interface{}) {
	l.Info(fmt.Sprint(format, v), nil)
}

// Usage:
// stdLogger := log.New(logger.InfoWriter(), "", 0)
// errorLogger := log.New(logger.ErrorWriter(), "", 0)
