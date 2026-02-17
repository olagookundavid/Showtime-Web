package tests_unit

// func TestCreateExample(t *testing.T) {
// 	// 1. Instantiate the Generated Mock
// 	mockService := mocks.NewIExampleService(t)

// 	// 2. Setup expectations
// 	// "When CreateExample is called with specific args, return nil (no error)"
// 	mockService.On("CreateExample", mock.Anything, mock.MatchedBy(func(req dto.InviteRequest) bool {
// 		return req.Email == "test@example.com"
// 	})).Return(nil)

// 	// 3. Inject the Mock into the Handler
// 	handler := transport.NewExampleHandler(mockService)

// 	// 4. Setup Gin context for the HTTP test
// 	w := httptest.NewRecorder()
// 	c, _ := gin.CreateTestContext(w)

// 	// Fake request body
// 	body := `{"email": "test@example.com", "roles": ["admin"]}`
// 	c.Request, _ = http.NewRequest("POST", "/example", strings.NewReader(body))

// 	// 5. Run the handler
// 	handler.CreateExample(c)

// 	// 6. Assertions
// 	assert.Equal(t, http.StatusCreated, w.Code)
// 	// mockService.AssertExpectations(t) // Verify is automatically called by GoMock/Testify if configured, but explicit is fine too
// }
