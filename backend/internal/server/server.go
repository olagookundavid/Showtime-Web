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
				shutdownError <- err
			}
			app.Logger.Info("completing background tasks", map[string]interface{}{"addr": srv.Addr})

			shutdownError <- nil
		})
}
