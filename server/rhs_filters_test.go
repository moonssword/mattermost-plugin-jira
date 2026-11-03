// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	jira "github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func canonicalCategoryKeys() map[string]bool {
	return map[string]bool{"new": true, "indeterminate": true, "done": true, "undefined": true}
}

func TestParseRHSFilter(t *testing.T) {
	for _, s := range []string{"", "assigned"} {
		f, err := parseRHSFilter(s)
		require.NoError(t, err)
		assert.Equal(t, RHSFilterAssigned, f)
	}
	for _, s := range []string{"reported", "watching", "sprint"} {
		f, err := parseRHSFilter(s)
		require.NoError(t, err)
		assert.Equal(t, RHSFilter(s), f)
	}
	_, err := parseRHSFilter("everything")
	assert.True(t, errors.Is(err, ErrInvalidRHSFilter))
}

func TestBuildFilterJQL(t *testing.T) {
	keys := canonicalCategoryKeys()
	cases := map[RHSFilter]string{
		RHSFilterAssigned: "assignee = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC",
		RHSFilterReported: "reporter = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC",
		RHSFilterWatching: "watcher = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC",
		RHSFilterSprint:   "assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC, key ASC",
	}
	for filter, want := range cases {
		got, err := buildFilterJQL(filter, "updated", keys)
		require.NoError(t, err, filter)
		assert.Equal(t, want, got, filter)
	}

	_, err := buildFilterJQL(RHSFilterAssigned, "priority", keys)
	assert.True(t, errors.Is(err, ErrInvalidRHSSort))

	// Without a known "done" category the open-issues clause would match everything on Cloud.
	_, err = buildFilterJQL(RHSFilterReported, "updated", map[string]bool{"new": true})
	assert.True(t, errors.Is(err, ErrInvalidStatusCategory))
}

func TestClassifyRHSQuery(t *testing.T) {
	cases := map[string]rhsSearchKind{
		"":                              rhsSearchNone,
		"   ":                           rhsSearchNone,
		"BACK-412":                      rhsSearchKey,
		"back-412":                      rhsSearchKey,
		" AUTOPS_2-7 ":                  rhsSearchKey,
		"экспорт":                       rhsSearchText,
		"Экспорт CSV в отчёте":          rhsSearchText,
		"login in progress":             rhsSearchText,
		"BACK-412 timeout":              rhsSearchText,
		"project = BACK":                rhsSearchJQL,
		"summary ~ export":              rhsSearchJQL,
		"assignee is EMPTY":             rhsSearchJQL,
		"status in (Open, Reopened)":    rhsSearchJQL,
		"priority >= High":              rhsSearchJQL,
		"labels not in (perf)":          rhsSearchJQL,
		"text ~ x ORDER BY created ASC": rhsSearchJQL,
	}
	for q, want := range cases {
		assert.Equal(t, want, classifyRHSQuery(q), q)
	}
}

func TestBuildSearchJQL(t *testing.T) {
	const order = " ORDER BY updated DESC, key ASC"

	jql, kind, err := buildSearchJQL("back-412", "updated")
	require.NoError(t, err)
	assert.Equal(t, rhsSearchKey, kind)
	assert.Equal(t, `key = "BACK-412"`, jql)

	jql, kind, err = buildSearchJQL("экспорт CSV", "updated")
	require.NoError(t, err)
	assert.Equal(t, rhsSearchText, kind)
	assert.Equal(t, `text ~ "экспорт CSV"`+order, jql)

	jql, _, err = buildSearchJQL(`he said "drop" table; (x) a+b`, "updated")
	require.NoError(t, err)
	assert.Equal(t, `text ~ "he said drop table; x a b"`+order, jql)

	jql, kind, err = buildSearchJQL(`"*?"`, "updated")
	require.NoError(t, err)
	assert.Equal(t, rhsSearchText, kind)
	assert.Equal(t, "", jql)

	jql, kind, err = buildSearchJQL("project = BACK", "created")
	require.NoError(t, err)
	assert.Equal(t, rhsSearchJQL, kind)
	assert.Equal(t, "project = BACK ORDER BY created DESC, key ASC", jql)

	jql, _, err = buildSearchJQL("project = BACK order by priority", "updated")
	require.NoError(t, err)
	assert.Equal(t, "project = BACK order by priority", jql)

	_, _, err = buildSearchJQL(strings.Repeat("a", rhsMaxQueryLength+1), "updated")
	assert.True(t, errors.Is(err, ErrInvalidRHSQuery))
}

func doRHSFilteredGet(t *testing.T, p *Plugin, instanceID string, params url.Values) (int, []byte) {
	t.Helper()
	params.Set("instance_id", instanceID)
	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSIssues)+"?"+params.Encode(), "connected_user")
	return w.Result().StatusCode, w.Body.Bytes()
}

func TestRHSHTTPFilteredIssues(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	total := 7
	issue := tes41Issue()
	issue.Fields.Created = jira.Time(time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC))
	issue.Fields.Duedate = jira.Date(time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC))
	issue.Fields.Priority = &jira.Priority{Name: "High", IconURL: "https://jira.example.com/high.svg"}
	client := &testRHSCloudClient{
		statuses:   fixtureStatuses(t),
		categories: fixtureCanonicalCategories(t),
		search:     &CloudSearchResult{Issues: []jira.Issue{issue}, IsLast: false, NextPageToken: "20", Total: &total},
	}
	inst := installRHSUserCloud(t, p, client)

	status, raw := doRHSFilteredGet(t, p, string(inst.GetID()), url.Values{"filter": {"watching"}, "next_page_token": {"20"}})
	require.Equal(t, http.StatusOK, status)

	var body rhsIssuesResult
	require.NoError(t, json.Unmarshal(raw, &body))
	require.Len(t, body.Issues, 1)
	assert.Equal(t, "2026-01-02T10:00:00Z", body.Issues[0].Created)
	assert.Equal(t, "2026-11-07", body.Issues[0].DueDate)
	assert.Equal(t, "High", body.Issues[0].Priority)
	assert.Empty(t, body.Tabs)
	assert.Equal(t, "20", body.NextPageToken)
	require.NotNil(t, body.Total)
	assert.Equal(t, 7, *body.Total)

	client.mu.Lock()
	defer client.mu.Unlock()
	assert.Equal(t, "watcher = currentUser() AND statusCategory != done ORDER BY updated DESC, key ASC", client.lastSearch.JQL)
	assert.Equal(t, "20", client.lastSearch.NextPageToken)
	assert.Contains(t, client.lastSearch.Fields, "duedate")
}

func TestRHSHTTPSearchIgnoresFilter(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCloudClient{statuses: fixtureStatuses(t), categories: fixtureCanonicalCategories(t)}
	inst := installRHSUserCloud(t, p, client)

	status, _ := doRHSFilteredGet(t, p, string(inst.GetID()), url.Values{"filter": {"reported"}, "q": {"экспорт"}})
	require.Equal(t, http.StatusOK, status)

	client.mu.Lock()
	defer client.mu.Unlock()
	assert.Equal(t, `text ~ "экспорт" ORDER BY updated DESC, key ASC`, client.lastSearch.JQL)
	assert.Equal(t, 0, client.statusCalls, "a search does not need the status cache")
}

func TestRHSHTTPSearchUnknownKeyIsEmpty(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCloudClient{
		statuses:   fixtureStatuses(t),
		categories: fixtureCanonicalCategories(t),
		searchErr:  RESTError{errors.New(" - An issue with key 'TES-999' does not exist for field 'key'.\n"), http.StatusBadRequest},
	}
	inst := installRHSUserCloud(t, p, client)

	status, raw := doRHSFilteredGet(t, p, string(inst.GetID()), url.Values{"q": {"TES-999"}})
	require.Equal(t, http.StatusOK, status)
	var body rhsIssuesResult
	require.NoError(t, json.Unmarshal(raw, &body))
	assert.Empty(t, body.Issues)
	assert.True(t, body.IsLast)
}

func TestRHSHTTPSearchInvalidJQLShowsJiraMessage(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCloudClient{
		statuses:   fixtureStatuses(t),
		categories: fixtureCanonicalCategories(t),
		searchErr:  RESTError{errors.New(" - Field 'bogus' does not exist or you do not have permission to view it.\n"), http.StatusBadRequest},
	}
	inst := installRHSUserCloud(t, p, client)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSIssues)+"?instance_id="+url.QueryEscape(string(inst.GetID()))+"&q="+url.QueryEscape("bogus = 1"), "connected_user")
	require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	body := decodeRHSError(t, w)
	assert.Equal(t, rhsErrInvalidQuery, body.Error)
	assert.Equal(t, "Field 'bogus' does not exist or you do not have permission to view it.", body.Message)
}

func TestRHSHTTPSearchOnlySpecialsIsEmptyWithoutJiraCall(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCloudClient{statuses: fixtureStatuses(t), categories: fixtureCanonicalCategories(t)}
	inst := installRHSUserCloud(t, p, client)

	status, _ := doRHSFilteredGet(t, p, string(inst.GetID()), url.Values{"q": {"*?!"}})
	require.Equal(t, http.StatusOK, status)
	client.mu.Lock()
	defer client.mu.Unlock()
	assert.Equal(t, 0, client.searchCalls)
}

func TestRHSHTTPInvalidFilter(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCloudClient{statuses: fixtureStatuses(t), categories: fixtureCanonicalCategories(t)}
	inst := installRHSUserCloud(t, p, client)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSIssues)+"?instance_id="+url.QueryEscape(string(inst.GetID()))+"&filter=all", "connected_user")
	require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	assert.Equal(t, rhsErrInvalidRequest, decodeRHSError(t, w).Error)
}
