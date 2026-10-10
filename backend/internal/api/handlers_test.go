package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockClient struct{}

func (m *mockClient) GetStatus(ctx context.Context) (int, error) {
	return http.StatusOK, nil
}

func TestHealth(t *testing.T) {
	h := NewHandler(&mockClient{}, nil, nil)
	req := httptest.NewRequest("GET", "/healthz", nil)
	rr := httptest.NewRecorder()

	h.Health(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	expected := `{"status":"ok"}` + "\n"
	if rr.Body.String() != expected {
		t.Errorf("handler returned unexpected body: got %v want %v", rr.Body.String(), expected)
	}
}
