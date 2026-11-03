// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServerRHSClient(t *testing.T, handler http.HandlerFunc) *jiraServerClient {
	t.Helper()
	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)
	jc, err := jira.NewClient(ts.Client(), ts.URL)
	require.NoError(t, err)
	client, ok := newServerClient(jc).(*jiraServerClient)
	require.True(t, ok)
	return client
}

func TestServerClientImplementsRHSClient(t *testing.T) {
	var _ rhsClient = (*jiraServerClient)(nil)
	var _ rhsClient = (*jiraCloudClient)(nil)
}

func TestServerRHSSearchJQLFirstPage(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/rest/api/2/search", r.URL.Path)

		q := r.URL.Query()
		assert.Equal(t, "assignee = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC", q.Get("jql"))
		assert.Equal(t, "2", q.Get("maxResults"))
		fields := q.Get("fields")
		assert.Contains(t, fields, "summary")
		assert.Contains(t, fields, "status")
		_, hasStart := q["startAt"]
		assert.False(t, hasStart)
		_, hasNext := q["nextPageToken"]
		assert.False(t, hasNext)

		writeJSON(w, http.StatusOK, loadRHSTestdata(t, "rhs-search-server-page1.json"))
	})

	result, err := client.SearchJQL(CloudSearchParams{
		JQL:        "assignee = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC",
		Fields:     []string{"summary", "status"},
		MaxResults: 2,
	})
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Len(t, result.Issues, 2)
	assert.Equal(t, "TES-41", result.Issues[0].Key)
	assert.Equal(t, "In Progress", result.Issues[0].Fields.Status.Name)
	assert.Equal(t, "indeterminate", result.Issues[0].Fields.Status.StatusCategory.Key)
	assert.Equal(t, "TES-42", result.Issues[1].Key)
	assert.Equal(t, "2", result.NextPageToken)
	assert.False(t, result.IsLast)
	assert.Equal(t, 1, requests)
}

func TestServerRHSSearchJQLOffsetPassthrough(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		assert.Equal(t, "/rest/api/2/search", r.URL.Path)
		assert.Equal(t, "2", r.URL.Query().Get("startAt"))
		writeJSON(w, http.StatusOK, loadRHSTestdata(t, "rhs-search-server-last.json"))
	})

	result, err := client.SearchJQL(CloudSearchParams{
		JQL:           "assignee = currentUser() ORDER BY updated DESC",
		Fields:        []string{"summary", "status"},
		MaxResults:    2,
		NextPageToken: "2",
	})
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Len(t, result.Issues, 1)
	assert.Equal(t, "TES-43", result.Issues[0].Key)
	assert.True(t, result.IsLast)
	assert.Equal(t, "", result.NextPageToken)
	assert.Equal(t, 1, requests)
}

func TestServerRHSSearchJQLEmptyResult(t *testing.T) {
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []byte(`{"startAt":0,"maxResults":20,"total":0,"issues":[]}`))
	})

	result, err := client.SearchJQL(CloudSearchParams{JQL: "assignee = currentUser()", MaxResults: 20})
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Empty(t, result.Issues)
	assert.True(t, result.IsLast)
	assert.Equal(t, "", result.NextPageToken)
}

func TestServerRHSSearchJQLInvalidPageToken(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		writeJSON(w, http.StatusOK, []byte(`{"issues":[]}`))
	})

	for _, token := range []string{"opaque-token-page-2", "-1", "1.5"} {
		result, err := client.SearchJQL(CloudSearchParams{JQL: "assignee = currentUser()", NextPageToken: token})
		assert.Nil(t, result, token)
		require.Error(t, err, token)
		assert.True(t, errors.Is(err, ErrInvalidRHSPageToken), token)
	}
	assert.Equal(t, 0, requests)
}

func TestServerRHSSearchJQLRateLimited(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Retry-After", "5")
		w.WriteHeader(http.StatusTooManyRequests)
	})

	result, err := client.SearchJQL(CloudSearchParams{JQL: "assignee = currentUser()", MaxResults: 20})
	assert.Nil(t, result)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrRateLimited))
	assert.Equal(t, 1, requests)
}

func TestServerRHSSearchJQLJiraError(t *testing.T) {
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusBadRequest, []byte(`{"errorMessages":["Field 'bogus' does not exist."],"errors":{}}`))
	})

	result, err := client.SearchJQL(CloudSearchParams{JQL: "bogus = 1", MaxResults: 20})
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not exist")
	var restErr RESTError
	require.True(t, errors.As(err, &restErr))
	assert.Equal(t, http.StatusBadRequest, restErr.Status)
}

func TestNormalizeServerSearchResult(t *testing.T) {
	issues := func(n int) []jira.Issue {
		out := make([]jira.Issue, n)
		return out
	}

	t.Run("middle page", func(t *testing.T) {
		got := normalizeServerSearchResult(20, serverSearchResult{Issues: issues(20), StartAt: 20, Total: 55})
		assert.False(t, got.IsLast)
		assert.Equal(t, "40", got.NextPageToken)
	})

	t.Run("exact last page", func(t *testing.T) {
		got := normalizeServerSearchResult(40, serverSearchResult{Issues: issues(15), StartAt: 40, Total: 55})
		assert.True(t, got.IsLast)
		assert.Equal(t, "", got.NextPageToken)
	})

	t.Run("jira omits startAt", func(t *testing.T) {
		got := normalizeServerSearchResult(20, serverSearchResult{Issues: issues(20), Total: 55})
		assert.False(t, got.IsLast)
		assert.Equal(t, "40", got.NextPageToken)
	})

	t.Run("empty page is last", func(t *testing.T) {
		got := normalizeServerSearchResult(60, serverSearchResult{StartAt: 60, Total: 55})
		assert.True(t, got.IsLast)
		assert.Empty(t, got.Issues)
	})
}

func TestServerRHSListStatuses(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/rest/api/2/status", r.URL.Path)
		writeJSON(w, http.StatusOK, loadRHSTestdata(t, "rhs-status.json"))
	})

	got, err := client.ListStatuses()
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "3", got[0].ID)
	assert.Equal(t, "In Progress", got[0].Name)
	assert.Equal(t, "indeterminate", got[0].StatusCategory.Key)
	assert.Equal(t, 4, got[0].StatusCategory.ID)
	assert.Nil(t, got[0].Scope)
	assert.Equal(t, "10001", got[1].ID)
	assert.Equal(t, "new", got[1].StatusCategory.Key)
	assert.Equal(t, 1, requests)
}

func TestServerRHSListStatusCategories(t *testing.T) {
	var requests int
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests++
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "/rest/api/2/statuscategory", r.URL.Path)
		writeJSON(w, http.StatusOK, loadRHSTestdata(t, "rhs-statuscategory.json"))
	})

	got, err := client.ListStatusCategories()
	require.NoError(t, err)
	require.Len(t, got, 4)
	assert.Equal(t, "undefined", got[0].Key)
	assert.Equal(t, "new", got[1].Key)
	assert.Equal(t, "indeterminate", got[2].Key)
	assert.Equal(t, "done", got[3].Key)
	assert.Equal(t, 1, requests)
}

func TestServerRHSStatusesError(t *testing.T) {
	client := newTestServerRHSClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	_, err := client.ListStatuses()
	require.Error(t, err)
	_, err = client.ListStatusCategories()
	require.Error(t, err)
}
