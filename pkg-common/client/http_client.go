package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"pkg-common/logger"
	"time"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:      100,
				IdleConnTimeout:   90 * time.Second,
				DisableKeepAlives: false,
			},
		},
	}
}

func (c *Client) Do(ctx context.Context, method, path string, reqBody, respBody any, headers map[string]string) error {
	log := logger.GetSingletonLogger()
	var body io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			log.Error(err.Error(), nil)
			return fmt.Errorf("marshal request: %w", err)
		}
		body = bytes.NewBuffer(b)
	}

	println(method, c.BaseURL+path, body)

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
	if err != nil {
		log.Error(err.Error(), nil)
		return fmt.Errorf("create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		log.Error(err.Error(), nil)
		return fmt.Errorf("do request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		b, _ := io.ReadAll(res.Body)
		log.Error(res.Status, nil)
		return fmt.Errorf("request failed [%d]: %s", res.StatusCode, string(b))
	}

	if respBody != nil {
		return json.NewDecoder(res.Body).Decode(respBody)
	}

	return nil
}
