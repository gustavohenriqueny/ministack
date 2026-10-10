package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRouter(t *testing.T) {
	h := NewHandler(&mockClient{}, nil, nil)
	r := NewRouter(h, nil)

	ts := httptest.NewServer(r)
	defer ts.Close()

	res, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Errorf("expected status OK; got %v", res.Status)
	}

	resV1, err := http.Get(ts.URL + "/api/v1/healthz")
	if err != nil {
		t.Fatal(err)
	}
	if resV1.StatusCode != http.StatusOK {
		t.Errorf("expected status OK for /api/v1/healthz; got %v", resV1.Status)
	}
}
