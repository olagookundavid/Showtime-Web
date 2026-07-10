package server

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"pkg-common/logger"
	"syscall"
	"time"

	"showtime-backend/cmd/api"
	"showtime-backend/internal/routes"

	"pkg-common/helpers"
)

func Serve(app *api.Application) error {
	logger := logger.GetSingletonLogger()
	errorLogger := log.New(logger.ErrorWriter(), "", 0)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", app.Config.Port),
		Handler:      routes.Routes(app),
		ErrorLog:     errorLogger,
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	shutdownError := make(chan error)
	shutdown(app, srv, shutdownError)

	//Start Server
	logger.Info("starting server", map[string]interface{}{"addr": srv.Addr, "env": app.Config.Env})
	err := srv.ListenAndServe()
	if !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	err = <-shutdownError
	if err != nil {
		return err
	}
	app.Logger.Info("stopped server", map[string]interface{}{"addr": srv.Addr})
	return nil
}

func shutdown(app *api.Application, srv *http.Server, shutdownError chan error) {
	helpers.BackgroundFunc(
		func() {
			// Intercept the signals, as before.
			quit := make(chan os.Signal, 1)
			signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
			s := <-quit
			app.Logger.Info("shutting down server", map[string]interface{}{"signal": s.String()})
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			err := srv.Shutdown(ctx)
			if err != nil {
				// Report and return — the channel is unbuffered and read exactly
				// once, so a second send below would deadlock this goroutine.
				shutdownError <- err
				return
			}
			app.Logger.Info("completing background tasks", map[string]interface{}{"addr": srv.Addr})

			// Stop the scheduler and cancel any in-flight job. This must happen
			// before main's deferred pool.Close(): a running job holds a DB
			// connection, and pool.Close() blocks until every connection is
			// returned — cancelling the job's context aborts its query so the
			// connection is released and the process can actually exit.
			if app.Cron != nil {
				app.Cron.Stop()
			}
			if app.CronCancel != nil {
				app.CronCancel()
			}

			// Close audit service to flush batches
			if app.AuditService != nil {
				app.AuditService.Close()
			}

			shutdownError <- nil
		})
}
