// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/kvstore"
)

// testAgileClient answers RESTGetRaw from canned JSON keyed by path, and for
// paged or filtered calls by "path|startAt" or "path|jql".
type testAgileClient struct {
	testClient
	responses map[string]string
	calls     []string
	err       error
}

func (c *testAgileClient) RESTGetRaw(rawPath string, params map[string]string, dest interface{}) error {
	key := rawPath
	switch {
	case params["jql"] != "":
		key += "|" + params["jql"]
	case params["startAt"] != "":
		key += "|" + params["startAt"]
	}
	c.calls = append(c.calls, key)
	if c.err != nil {
		return c.err
	}
	body, ok := c.responses[key]
	if !ok {
		body, ok = c.responses[rawPath]
	}
	if !ok {
		return errors.New("unexpected call " + key)
	}
	return json.Unmarshal([]byte(body), dest)
}

func TestParseRHSEstimateField(t *testing.T) {
	got, err := parseRHSEstimateField(" customfield_10111 ")
	require.NoError(t, err)
	assert.Equal(t, "customfield_10111", got)

	got, err = parseRHSEstimateField("")
	require.NoError(t, err)
	assert.Equal(t, "", got)

	for _, bad := range []string{"summary", "customfield_", "customfield_1,status", "timeoriginalestimate"} {
		_, err = parseRHSEstimateField(bad)
		assert.ErrorIs(t, err, ErrInvalidRHSBoard, bad)
	}
}

func TestParseRHSBoardID(t *testing.T) {
	id, err := parseRHSBoardID("12")
	require.NoError(t, err)
	assert.Equal(t, 12, id)
	for _, bad := range []string{"", "0", "-3", "abc", "1;2"} {
		_, err = parseRHSBoardID(bad)
		assert.ErrorIs(t, err, ErrInvalidRHSBoard, bad)
	}
}

func TestRHSBoardColumnsDropsEmpty(t *testing.T) {
	var cfg jiraAgileBoardConfig
	require.NoError(t, json.Unmarshal([]byte(`{"columnConfig":{"columns":[
		{"name":"Backlog","statuses":[]},
		{"name":"To Do","statuses":[{"id":"10000"}]},
		{"name":"Doing","statuses":[{"id":"3"},{"id":"10003"}]}
	]}}`), &cfg))
	assert.Equal(t, []RHSBoardColumn{
		{Name: "To Do", StatusIDs: []string{"10000"}},
		{Name: "Doing", StatusIDs: []string{"3", "10003"}},
	}, rhsBoardColumns(&cfg))
}

func TestRHSBoardEstimate(t *testing.T) {
	var cfg jiraAgileBoardConfig
	require.NoError(t, json.Unmarshal([]byte(`{"estimation":{"type":"field","field":{"fieldId":"customfield_10111","displayName":"Story Points"}}}`), &cfg))
	id, name := rhsBoardEstimate(&cfg)
	assert.Equal(t, "customfield_10111", id)
	assert.Equal(t, "Story Points", name)

	require.NoError(t, json.Unmarshal([]byte(`{"estimation":{"type":"field","field":{"fieldId":"timeoriginalestimate"}}}`), &cfg))
	id, _ = rhsBoardEstimate(&cfg)
	assert.Equal(t, "", id)
}

func sprintIssuesJSON(total int, issues ...string) string {
	return `{"total":` + jsonInt(total) + `,"issues":[` + strings.Join(issues, ",") + `]}`
}

func jsonInt(v int) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func sprintIssue(category string, points string) string {
	sp := ""
	if points != "" {
		sp = `,"customfield_10111":` + points
	}
	return `{"key":"A-1","fields":{"status":{"id":"1","statusCategory":{"key":"` + category + `"}}` + sp + `}}`
}

func TestSprintProgressSumsPoints(t *testing.T) {
	path := "rest/agile/1.0/board/7/sprint/3/issue"
	client := &testAgileClient{responses: map[string]string{
		path + "|0": sprintIssuesJSON(4, sprintIssue("new", "3"), sprintIssue("indeterminate", "5")),
		path + "|2": sprintIssuesJSON(4, sprintIssue("done", "8"), sprintIssue("done", "null")),
	}}
	progress, err := sprintProgress(client, 7, 3, "customfield_10111")
	require.NoError(t, err)
	assert.Equal(t, &RHSBoardProgress{Unit: rhsProgressPoints, ToDo: 3, InProgress: 5, Done: 8}, progress)
	assert.Equal(t, []string{path + "|0", path + "|2"}, client.calls)
}

func TestSprintProgressCountsIssuesWithoutEstimation(t *testing.T) {
	path := "rest/agile/1.0/board/7/sprint/3/issue"
	client := &testAgileClient{responses: map[string]string{
		path + "|0": sprintIssuesJSON(3, sprintIssue("new", "3"), sprintIssue("done", ""), sprintIssue("done", "")),
	}}
	progress, err := sprintProgress(client, 7, 3, "")
	require.NoError(t, err)
	assert.Equal(t, &RHSBoardProgress{Unit: rhsProgressIssues, ToDo: 1, Done: 2}, progress)
}

func TestKanbanProgressCounts(t *testing.T) {
	path := "rest/agile/1.0/board/1/issue"
	client := &testAgileClient{responses: map[string]string{
		path + "|statusCategory = new":           `{"total":8,"issues":[]}`,
		path + "|statusCategory = indeterminate": `{"total":2,"issues":[]}`,
		path + "|" + rhsKanbanDoneJQL:            `{"total":5,"issues":[]}`,
	}}
	progress, err := kanbanProgress(client, 1)
	require.NoError(t, err)
	assert.Equal(t, &RHSBoardProgress{Unit: rhsProgressIssues, ToDo: 8, InProgress: 2, Done: 5}, progress)
}

func TestLoadRHSBoardScrum(t *testing.T) {
	p := &Plugin{}
	instance := testInstance1
	client := &testAgileClient{responses: map[string]string{
		"rest/agile/1.0/board/7/configuration": `{"name":"cfg","columnConfig":{"columns":[{"name":"To Do","statuses":[{"id":"1"}]}]},
			"estimation":{"field":{"fieldId":"customfield_10111","displayName":"Story Points"}}}`,
		"rest/agile/1.0/board/7":                  `{"id":7,"name":"BACK board","type":"scrum","location":{"projectKey":"BACK","projectName":"Backend"}}`,
		"rest/agile/1.0/board/7/sprint":           `{"values":[{"id":3,"name":"Спринт 34","state":"active","startDate":"2026-11-01T10:00:00.000+03:00","endDate":"2026-11-14T10:00:00.000+03:00"}]}`,
		"rest/agile/1.0/board/7/sprint/3/issue|0": sprintIssuesJSON(1, sprintIssue("indeterminate", "2.25")),
	}}
	board, err := p.loadRHSBoard(instance, client, 7)
	require.NoError(t, err)
	assert.Equal(t, "BACK board", board.Name)
	assert.Equal(t, "BACK", board.ProjectKey)
	assert.Equal(t, "customfield_10111", board.EstimateField)
	require.NotNil(t, board.Sprint)
	assert.Equal(t, "Спринт 34", board.Sprint.Name)
	assert.Equal(t, "2026-11-14T07:00:00Z", board.Sprint.EndDate)
	assert.Equal(t, 2.3, board.Progress.InProgress)
	assert.Contains(t, board.BrowseURL, "rapidView=7")
}

func TestLoadRHSBoardScrumWithoutSprint(t *testing.T) {
	p := &Plugin{}
	client := &testAgileClient{responses: map[string]string{
		"rest/agile/1.0/board/7/configuration": `{"columnConfig":{"columns":[]}}`,
		"rest/agile/1.0/board/7":               `{"id":7,"name":"B","type":"scrum"}`,
		"rest/agile/1.0/board/7/sprint":        `{"values":[]}`,
	}}
	board, err := p.loadRHSBoard(testInstance1, client, 7)
	require.NoError(t, err)
	assert.Nil(t, board.Sprint)
	assert.Nil(t, board.Progress)
	assert.Equal(t, []RHSBoardColumn{}, board.Columns)
}

func TestApplyRHSEstimates(t *testing.T) {
	var issues []jira.Issue
	require.NoError(t, json.Unmarshal([]byte(`[{"key":"A-1","fields":{"customfield_10111":5}},{"key":"A-2","fields":{"customfield_10111":null}}]`), &issues))
	out := []RHSIssue{{Key: "A-1"}, {Key: "A-2"}}
	applyRHSEstimates(out, issues, "customfield_10111")
	require.NotNil(t, out[0].Estimate)
	assert.Equal(t, 5.0, *out[0].Estimate)
	assert.Nil(t, out[1].Estimate)
}

func TestRHSAgileTime(t *testing.T) {
	assert.Equal(t, "2026-11-14T07:00:00Z", rhsAgileTime("2026-11-14T10:00:00.000+03:00"))
	assert.Equal(t, "2026-11-14T07:00:00Z", rhsAgileTime("2026-11-14T10:00:00.000+0300"))
	assert.Equal(t, "", rhsAgileTime("soon"))
}

func TestSprintProgressFallsBackToIssuesWithoutPoints(t *testing.T) {
	path := "rest/agile/1.0/board/7/sprint/3/issue"
	client := &testAgileClient{responses: map[string]string{
		path + "|0": sprintIssuesJSON(2, sprintIssue("new", ""), sprintIssue("done", "null")),
	}}
	progress, err := sprintProgress(client, 7, 3, "customfield_10111")
	require.NoError(t, err)
	assert.Equal(t, &RHSBoardProgress{Unit: rhsProgressIssues, ToDo: 1, Done: 1}, progress)
}

func TestRHSNotConnected(t *testing.T) {
	assert.True(t, rhsNotConnected(nil, kvstore.ErrNotFound))
	assert.True(t, rhsNotConnected(&Connection{}, nil))
	assert.True(t, rhsNotConnected(&Connection{User: jira.User{Name: "ivan"}}, nil), "a name without a token is not a connection")
	assert.False(t, rhsNotConnected(&Connection{Oauth1AccessToken: "t"}, nil))
	assert.False(t, rhsNotConnected(nil, errors.New("kv down")))
}

func TestRHSBoardsForUnconnectedUser(t *testing.T) {
	err := errors.Wrap(kvstore.ErrNotFound, "no access token")
	w := httptest.NewRecorder()
	status, _ := respondRHSErr(w, err)
	assert.Equal(t, http.StatusUnauthorized, status)
	assert.Contains(t, w.Body.String(), rhsErrNotConnected)
}
