// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"

	"github.com/pkg/errors"
)

// The board and sprint filters list finished issues too. Sorted by date
// alone, a board with many recently closed issues fills the first pages with
// them, and the panel folds "Done": the list looked empty until "Show more".
// Jira cannot sort by status category, so these lists are read in two passes,
// open issues first, then finished ones.

// rhsDonePageTokenPrefix marks a page token of the second pass. Tokens of the
// first pass are Jira's own, as for the other lists.
const rhsDonePageTokenPrefix = "done:"

// rhsOpenFirstFilter reports whether a quick filter lists finished issues.
func rhsOpenFirstFilter(filter RHSFilter) bool {
	return filter == RHSFilterBoard || filter == RHSFilterSprint
}

// rhsOpenFirstJQL splits a filter's JQL into its open and finished parts.
func rhsOpenFirstJQL(jql, order string) (open, done string, err error) {
	where := strings.TrimSuffix(jql, order)
	if order == "" || where == jql || strings.TrimSpace(where) == "" {
		return "", "", errors.Errorf("unexpected filter JQL %q", jql)
	}
	where = "(" + where + ")"
	return where + " AND statusCategory != " + statusCategoryKeyDone + order,
		where + " AND statusCategory = " + statusCategoryKeyDone + order, nil
}

// searchRHSOpenFirst reads one page: open issues while there are any, then
// finished ones. The page where the open issues end is topped up with
// finished ones, so no page is empty while more remain.
func searchRHSOpenFirst(client rhsClient, params CloudSearchParams, openJQL, doneJQL string) (*CloudSearchResult, error) {
	pageSize := params.MaxResults
	if inner, ok := strings.CutPrefix(params.NextPageToken, rhsDonePageTokenPrefix); ok {
		done, err := client.SearchJQL(CloudSearchParams{JQL: doneJQL, Fields: params.Fields, MaxResults: pageSize, NextPageToken: inner})
		if err != nil {
			return nil, err
		}
		// The total was given with the first page; this pass knows only its own.
		token := rhsDoneToken(done)
		return &CloudSearchResult{Issues: done.Issues, IsLast: token == "", NextPageToken: token}, nil
	}

	firstPage := params.NextPageToken == ""
	open, err := client.SearchJQL(CloudSearchParams{JQL: openJQL, Fields: params.Fields, MaxResults: pageSize, NextPageToken: params.NextPageToken})
	if err != nil {
		return nil, err
	}
	if !open.IsLast {
		result := &CloudSearchResult{Issues: open.Issues, NextPageToken: open.NextPageToken}
		if firstPage && open.Total != nil {
			// One issue is enough to learn how many finished ones there are.
			done, doneErr := client.SearchJQL(CloudSearchParams{JQL: doneJQL, Fields: params.Fields, MaxResults: 1})
			if doneErr != nil {
				return nil, doneErr
			}
			result.Total = rhsSumTotals(open.Total, done.Total)
		}
		return result, nil
	}

	room := pageSize - len(open.Issues)
	if room < 1 {
		room = 1
	}
	done, err := client.SearchJQL(CloudSearchParams{JQL: doneJQL, Fields: params.Fields, MaxResults: room})
	if err != nil {
		return nil, err
	}
	token := rhsDoneToken(done)
	result := &CloudSearchResult{
		Issues:        append(open.Issues, done.Issues...),
		IsLast:        token == "",
		NextPageToken: token,
	}
	if firstPage {
		result.Total = rhsSumTotals(open.Total, done.Total)
	}
	return result, nil
}

func rhsDoneToken(done *CloudSearchResult) string {
	if done.IsLast || done.NextPageToken == "" {
		return ""
	}
	return rhsDonePageTokenPrefix + done.NextPageToken
}

func rhsSumTotals(a, b *int) *int {
	if a == nil || b == nil {
		return nil
	}
	sum := *a + *b
	return &sum
}

// searchRHSOpenFirstPage splits the JQL built for a board or sprint filter and
// reads one page of it, open issues first.
func searchRHSOpenFirstPage(client rhsClient, params CloudSearchParams, sortField string) (*CloudSearchResult, error) {
	order, err := rhsOrderBy(sortField)
	if err != nil {
		return nil, err
	}
	openJQL, doneJQL, err := rhsOpenFirstJQL(params.JQL, order)
	if err != nil {
		return nil, err
	}
	return searchRHSOpenFirst(client, params, openJQL, doneJQL)
}
