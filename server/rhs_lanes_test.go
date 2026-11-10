// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testLaneOrder = " ORDER BY updated DESC, key ASC"

var testLaneScope = &rhsBoardScope{
	jql: "filter = 7",
	columns: []RHSBoardColumn{
		{Name: "To Do", StatusIDs: []string{"1", "10000"}},
		{Name: "Done", StatusIDs: []string{"10001"}},
	},
}

// countingRHSClient answers every search with a total picked by a part of
// the JQL.
type countingRHSClient struct {
	testRHSCloudClient
	mu      sync.Mutex
	totals  map[string]int
	jqls    []string
	noTotal bool
}

func (c *countingRHSClient) SearchJQL(params CloudSearchParams) (*CloudSearchResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.jqls = append(c.jqls, params.JQL)
	if c.noTotal {
		return &CloudSearchResult{IsLast: true}, nil
	}
	for part, total := range c.totals {
		if strings.Contains(params.JQL, part) {
			n := total
			return &CloudSearchResult{IsLast: true, Total: &n}, nil
		}
	}
	zero := 0
	return &CloudSearchResult{IsLast: true, Total: &zero}, nil
}

func TestRHSLaneClause(t *testing.T) {
	for lane, want := range map[string]string{
		"column:0": "status in (1, 10000)",
		"column:1": "status in (10001)",
		"outside":  "status not in (1, 10000, 10001)",
	} {
		got, err := rhsLaneClause(testLaneScope, lane)
		require.NoError(t, err, lane)
		assert.Equal(t, want, got, lane)
	}
	for _, lane := range []string{"column:2", "column:-1", "column:x", "category:done", ""} {
		_, err := rhsLaneClause(testLaneScope, lane)
		assert.ErrorIs(t, err, ErrInvalidRHSBoard, lane)
	}

	for lane, want := range map[string]string{
		"category:new":           "statusCategory not in (indeterminate, done)",
		"category:indeterminate": "statusCategory = indeterminate",
		"category:done":          "statusCategory = done",
	} {
		got, err := rhsLaneClause(nil, lane)
		require.NoError(t, err, lane)
		assert.Equal(t, want, got, lane)
	}
	_, err := rhsLaneClause(nil, "column:0")
	assert.ErrorIs(t, err, ErrInvalidRHSBoard)

	_, err = rhsLaneClause(&rhsBoardScope{columns: []RHSBoardColumn{{StatusIDs: []string{"1) OR (1=1"}}}}, "column:0")
	assert.Error(t, err)
}

func TestRHSLaneJQL(t *testing.T) {
	q := &rhsFilteredQuery{sort: "updated", kind: rhsSearchNone, scope: testLaneScope, jql: "filter = 7 AND sprint in openSprints()" + testLaneOrder}
	got, err := rhsLaneJQL(q, "column:1")
	require.NoError(t, err)
	assert.Equal(t, "(filter = 7 AND sprint in openSprints()) AND status in (10001)"+testLaneOrder, got)

	text := &rhsFilteredQuery{sort: "updated", kind: rhsSearchText, jql: `text ~ "login"` + testLaneOrder}
	got, err = rhsLaneJQL(text, "category:indeterminate")
	require.NoError(t, err)
	assert.Equal(t, `(text ~ "login") AND statusCategory = indeterminate`+testLaneOrder, got)

	for _, unsupported := range []*rhsFilteredQuery{
		{sort: "updated", kind: rhsSearchKey, jql: `key = "A-1"`},
		{sort: "updated", kind: rhsSearchJQL, jql: "project = A ORDER BY rank"},
	} {
		_, err = rhsLaneJQL(unsupported, "category:done")
		assert.ErrorIs(t, err, ErrInvalidRHSQuery)
	}
}

func TestCountRHSLanes(t *testing.T) {
	t.Run("board columns and issues outside them", func(t *testing.T) {
		client := &countingRHSClient{totals: map[string]int{
			"status in (1, 10000)":   12,
			"status in (10001)":      40,
			"status not in (1, 1000": 2,
		}}
		q := &rhsFilteredQuery{client: client, sort: "updated", kind: rhsSearchNone, scope: testLaneScope, jql: "filter = 7" + testLaneOrder}
		lanes, err := countRHSLanes(q, map[string]string{"1": "new", "10000": "indeterminate", "10001": "done"})
		require.NoError(t, err)
		assert.True(t, lanes.Supported)
		require.Len(t, lanes.Lanes, 3)
		assert.Equal(t, "indeterminate", lanes.Lanes[0].CategoryKey)
		assert.Equal(t, "done", lanes.Lanes[1].CategoryKey)
		assert.Equal(t, "", lanes.Lanes[2].CategoryKey)
		got := map[string]int{}
		for _, lane := range lanes.Lanes {
			require.NotNil(t, lane.Count, lane.ID)
			got[lane.ID] = *lane.Count
		}
		assert.Equal(t, map[string]int{"column:0": 12, "column:1": 40, "outside": 2}, got)
		assert.Len(t, client.jqls, 3)
	})

	t.Run("status categories without a board", func(t *testing.T) {
		client := &countingRHSClient{noTotal: true}
		q := &rhsFilteredQuery{client: client, sort: "updated", kind: rhsSearchNone, jql: "assignee = currentUser()" + testLaneOrder}
		lanes, err := countRHSLanes(q, nil)
		require.NoError(t, err)
		require.Len(t, lanes.Lanes, 3)
		assert.Equal(t, "category:new", lanes.Lanes[0].ID)
		assert.Equal(t, "new", lanes.Lanes[0].CategoryKey)
		assert.Nil(t, lanes.Lanes[0].Count)
	})

	t.Run("a search that cannot be split", func(t *testing.T) {
		client := &countingRHSClient{}
		q := &rhsFilteredQuery{client: client, sort: "updated", kind: rhsSearchKey, jql: `key = "A-1"`}
		lanes, err := countRHSLanes(q, nil)
		require.NoError(t, err)
		assert.False(t, lanes.Supported)
		assert.Empty(t, client.jqls)
	})

	t.Run("nothing can match", func(t *testing.T) {
		client := &countingRHSClient{}
		q := &rhsFilteredQuery{client: client, sort: "updated", kind: rhsSearchText, scope: testLaneScope}
		lanes, err := countRHSLanes(q, nil)
		require.NoError(t, err)
		assert.True(t, lanes.Supported)
		for _, lane := range lanes.Lanes {
			assert.Equal(t, 0, *lane.Count)
		}
		assert.Empty(t, client.jqls)
	})
}
