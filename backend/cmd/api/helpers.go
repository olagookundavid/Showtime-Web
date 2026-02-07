package api

// // Background function that also has a recover for dealing with panic
// func (app *Application) Background(fn func()) {
// 	app.Wg.Add(1)
// 	go func() {
// 		defer app.Wg.Done()
// 		defer func() {
// 			if err := recover(); err != nil {
// 				app.Logger.Error(fmt.Errorf("%s", err).Error(), nil)
// 			}
// 		}()
// 		fn()
// 		app.Wg.Wait()
// 	}()
// }

// // HealthcheckHandler godoc
// // @Summary      Show the status of the server
// // @Description  Get basic health and environment information
// // @Tags         health
// // @Accept       json
// // @Produce      json
// // @Success      200  {object}  map[string]interface{}
// // @Router       /api/v1/admin/healthcheck [get]
// func (app *Application) HealthcheckHandler(c *gin.Context) {

// 	env := gin.H{
// 		"status": "available",
// 		"system_info": map[string]string{
// 			"environment": app.Config.Env,
// 			"version":     vcs.Version(),
// 		},
// 	}
// 	c.JSON(http.StatusOK, env)

// }

// func (app *Application) InternalServerErrorHandler(c *gin.Context, recovered any) {
// 	var errMessage string

// 	// If the recovered value is a string, treat it as an error message.
// 	if err, ok := recovered.(string); ok {
// 		errMessage = err
// 	} else {
// 		errMessage = "unknown error"
// 	}
// 	devErr := errors.New(errMessage)
// 	app.ServerErrorResponse(c, devErr)
// }

// func (app *Application) NotFoundResponse(c *gin.Context) {
// 	c.JSON(http.StatusNotFound, gin.H{"error": "Resource not found"})
// }

// func (app *Application) MethodNotAllowedResponse(c *gin.Context) {
// 	c.JSON(http.StatusMethodNotAllowed, gin.H{"error": "Method not allowed"})
// }

// func (app *Application) rateLimitExceededResponse(c *gin.Context) {
// 	message := "rate limit exceeded"
// 	app.errorResponse(c, http.StatusTooManyRequests, message)
// }

// func (app *Application) unAuthorizedResponse(c *gin.Context, msg string) {
// 	app.errorResponse(c, http.StatusUnauthorized, msg)
// }

// func (app *Application) badResponse(c *gin.Context, msg string) {
// 	app.errorResponse(c, http.StatusBadRequest, msg)
// }

// func (app *Application) invalidCredentialsResponse(c *gin.Context) {
// 	message := "invalid authentication credentials"
// 	app.errorResponse(c, http.StatusUnauthorized, message)
// }

// // Errors helpers

// // map[string]string{
// // 		"request_method": r.Method,
// // 		"request_url":    r.URL.String()}

// func (app *Application) errorResponse(c *gin.Context, status int, message string) {
// 	app.Logger.Error(message, nil)
// 	c.JSON(status, gin.H{"error": message})
// }

// func (app *Application) ServerErrorResponse(c *gin.Context, err error) {
// 	message := "Internal server error"
// 	app.Logger.Error(err.Error(), nil)
// 	c.JSON(http.StatusInternalServerError, gin.H{"error": message, "devError": err.Error()})
// }

// func (app *Application) editConflictResponse(c *gin.Context) {
// 	message := "unable to update the record due to an edit conflict, please try again"
// 	app.errorResponse(c, http.StatusConflict, message)
// }

// func (app *Application) background(fn func()) {
// 	// Increment the WaitGroup counter.
// 	app.Wg.Add(1)

// 	// Launch a background goroutine.
// 	go func() {
// 		// Use defer to decrement the WaitGroup counter before the goroutine returns.
// 		defer app.Wg.Done()

// 		// Recover any panic.
// 		defer func() {
// 			if err := recover(); err != nil {
// 				app.Logger.Error(fmt.Sprintf("%s", err), nil)
// 			}
// 		}()
// 		// Execute the arbitrary function that we passed as the parameter.
// 		fn()
// 	}()
// }
