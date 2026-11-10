// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strconv"
	"strings"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pagedRHSClient serves two lists, open and finished issues, with offset
// tokens like the Server/DC client.
type pagedRHSClient struct {
	testRHSCloudClient
	open, done int
	calls      []CloudSearchParams
}

func (c *pagedRHSClient) SearchJQL(params CloudSearchParams) (*CloudSearchResult, error) {
	c.calls = append(c.calls, params)
	count, prefix := c.open, "OPEN-"
	if strings.Contains(params.JQL, "statusCategory = done") {
		count, prefix = c.done, "DONE-"
	}
	start := 0
	if params.NextPageToken != "" {
		start, _ = strconv.Atoi(params.NextPageToken)
	}
	end := start + params.MaxResults
	if end > count {
		end = count
	}
	result := &CloudSearchResult{Issues: []jira.Issue{}, Total: &count}
	for i := start; i < end; i++ {
		result.Issues = append(result.Issues, jira.Issue{Key: prefix + strconv.Itoa(i)})
	}
	result.IsLast = end >= count
	if !result.IsLast {
		result.NextPageToken = strconv.Itoa(end)
	}
	return result, nil
}

func keysOf(result *CloudSearchResult) []string {
	keys := []string{}
	for _, issue := range result.Issues {
		keys = append(keys, issue.Key)
	}
	return keys
}

// readAllOpenFirst pages through a list the way the panel does.
func readAllOpenFirst(t *testing.T, client *pagedRHSClient, pageSize int) ([][]string, *int) {
	t.Helper()
	pages := [][]string{}
	token := ""
	var total *int
	for i := 0; i < 20; i++ {
		page, err := searchRHSOpenFirstPage(client, CloudSearchParams{
			JQL:           "filter = 1 AND sprint in openSprints() ORDER BY updated DESC, key ASC",
			MaxResults:    pageSize,
			NextPageToken: token,
		}, "updated")
		require.NoError(t, err)
		if i == 0 {
			total = page.Total
		}
		pages = append(pages, keysOf(page))
		if page.IsLast {
			return pages, total
		}
		require.NotEmpty(t, page.NextPageToken)
		token = page.NextPageToken
	}
	t.Fatal("too many pages")
	return nil, nil
}

func TestRHSOpenFirstJQL(t *testing.T) {
	order := " ORDER BY updated DESC, key ASC"
	open, done, err := rhsOpenFirstJQL("filter = 10 AND (statusCategory != done OR (updated >= -14d))"+order, order)
	require.NoError(t, err)
	assert.Equal(t, "(filter = 10 AND (statusCategory != done OR (updated >= -14d))) AND statusCategory != done"+order, open)
	assert.Equal(t, "(filter = 10 AND (statusCategory != done OR (updated >= -14d))) AND statusCategory = done"+order, done)

	_, _, err = rhsOpenFirstJQL("project = X", order)
	assert.Error(t, err)
}

func TestSearchRHSOpenFirst(t *testing.T) {
	t.Run("many finished issues do not push open ones off the first page", func(t *testing.T) {
		client := &pagedRHSClient{open: 3, done: 45}
		pages, total := readAllOpenFirst(t, client, 20)
		require.Len(t, pages, 3)
		assert.Equal(t, []string{"OPEN-0", "OPEN-1", "OPEN-2"}, pages[0][:3])
		assert.Len(t, pages[0], 20)
		assert.Len(t, pages[1], 20)
		assert.Len(t, pages[2], 8)
		require.NotNil(t, total)
		assert.Equal(t, 48, *total)
	})

	t.Run("open issues fill several pages before finished ones", func(t *testing.T) {
		client := &pagedRHSClient{open: 25, done: 4}
		pages, total := readAllOpenFirst(t, client, 20)
		require.Len(t, pages, 2)
		assert.Len(t, pages[0], 20)
		assert.Equal(t, "OPEN-20", pages[1][0])
		assert.Equal(t, []string{"OPEN-24", "DONE-0", "DONE-1", "DONE-2", "DONE-3"}, pages[1][4:])
		require.NotNil(t, total)
		assert.Equal(t, 29, *total)
	})

	t.Run("a full page of open issues ends exactly with no finished ones", func(t *testing.T) {
		client := &pagedRHSClient{open: 20, done: 0}
		pages, total := readAllOpenFirst(t, client, 20)
		require.Len(t, pages, 1)
		assert.Len(t, pages[0], 20)
		assert.Equal(t, 20, *total)
	})

	t.Run("only finished issues", func(t *testing.T) {
		client := &pagedRHSClient{open: 0, done: 2}
		pages, _ := readAllOpenFirst(t, client, 20)
		assert.Equal(t, [][]string{{"DONE-0", "DONE-1"}}, pages)
	})

	t.Run("empty list", func(t *testing.T) {
		client := &pagedRHSClient{}
		pages, total := readAllOpenFirst(t, client, 20)
		assert.Equal(t, [][]string{{}}, pages)
		assert.Equal(t, 0, *total)
	})
}
