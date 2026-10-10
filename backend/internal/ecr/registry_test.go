package ecr

import (
	"testing"
)

func TestExtractRepoName(t *testing.T) {
	tests := []struct {
		path     string
		suffix   string
		expected string
	}{
		{
			path:     "/v2/my-repo/manifests/latest",
			suffix:   "/manifests/latest",
			expected: "my-repo",
		},
		{
			path:     "/v2/org/my-repo/manifests/latest",
			suffix:   "/manifests/latest",
			expected: "org/my-repo",
		},
		{
			path:     "/v2/org/team/my-repo/blobs/uploads/uuid-12345",
			suffix:   "/blobs/uploads/uuid-12345",
			expected: "org/team/my-repo",
		},
	}

	for _, tt := range tests {
		actual := extractRepoName(tt.path, tt.suffix)
		if actual != tt.expected {
			t.Errorf("extractRepoName(%q, %q) = %q; expected %q", tt.path, tt.suffix, actual, tt.expected)
		}
	}
}

func TestParseRegistryPath(t *testing.T) {
	tests := []struct {
		path          string
		expectedRepo  string
		expectedType  string
		expectedValue string
	}{
		{
			path:          "/v2/",
			expectedRepo:  "",
			expectedType:  "handshake",
			expectedValue: "",
		},
		{
			path:          "/v2/my-repo/blobs/uploads/",
			expectedRepo:  "my-repo",
			expectedType:  "uploads_init",
			expectedValue: "",
		},
		{
			path:          "/v2/org/team/my-repo/blobs/uploads/uuid-123",
			expectedRepo:  "org/team/my-repo",
			expectedType:  "upload_session",
			expectedValue: "uuid-123",
		},
		{
			path:          "/v2/org/my-repo/blobs/sha256:abc123def",
			expectedRepo:  "org/my-repo",
			expectedType:  "blob",
			expectedValue: "sha256:abc123def",
		},
		{
			path:          "/v2/my-repo/manifests/latest",
			expectedRepo:  "my-repo",
			expectedType:  "manifest",
			expectedValue: "latest",
		},
		{
			path:          "/v2/org/my-repo/tags/list",
			expectedRepo:  "org/my-repo",
			expectedType:  "tags_list",
			expectedValue: "",
		},
	}

	for _, tt := range tests {
		repo, rType, val := parseRegistryPath(tt.path)
		if repo != tt.expectedRepo || rType != tt.expectedType || val != tt.expectedValue {
			t.Errorf("parseRegistryPath(%q) = (%q, %q, %q); expected (%q, %q, %q)",
				tt.path, repo, rType, val, tt.expectedRepo, tt.expectedType, tt.expectedValue)
		}
	}
}
