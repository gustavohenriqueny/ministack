package client

import (
	"context"
	"net/http"
	"time"
)

type MinistackClient interface {
	GetStatus(ctx context.Context) (int, error)
}

type client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) MinistackClient {
	return &client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (c *client) GetStatus(ctx context.Context) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/_ministack/health", nil)
	if err != nil {
		return 0, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}
