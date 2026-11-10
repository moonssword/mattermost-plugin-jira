// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// The columns of the board view are loaded one at a time, when the user opens
// them, and their counters come first in one request. A column is the list of
// the current filter or search limited to some statuses: the board's columns,
// or the three status categories when no board is chosen.
const (
	routeAPIRHSLanes = "/rhs/lanes"
	queryRHSLane     = "lane"

	rhsLaneColumnPrefix   = "column:"
	rhsLaneCategoryPrefix = "category:"
	rhsLaneOutside        = "outside"
)

var rhsLaneCategories = []string{statusCategoryKeyNew, statusCategoryKeyIndeterminate, statusCategoryKeyDone}

// RHSLaneCount is the number of issues in a column. Count is nil when Jira
// does not count (Cloud).
type RHSLaneCount struct {
	ID    string `json:"id"`
	Count *int   `json:"count"`

	// CategoryKey lets the view open the column with work in progress first.
	CategoryKey string `json:"categoryKey,omitempty"`
}

// RHSLanes answers the counters request. Without Supported the board view
// places the loaded list in columns itself, as for a search by key or a JQL
// with its own order.
type RHSLanes struct {
	Supported bool           `json:"supported"`
	Lanes     []RHSLaneCount `json:"lanes"`
}

func (p *Plugin) registerRHSLaneRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSLanes, p.checkAuth(p.handleResponse(p.httpRHSGetLanes))).Methods(http.MethodGet)
}

// rhsLaneIDs lists the columns of a query: the board's own, plus the issues
// whose status is not on the board, or the status categories.
func rhsLaneIDs(scope *rhsBoardScope) []string {
	if scope == nil || len(scope.columns) == 0 {
		ids := make([]string, 0, len(rhsLaneCategories))
		for _, key := range rhsLaneCategories {
			ids = append(ids, rhsLaneCategoryPrefix+key)
		}
		return ids
	}
	ids := make([]string, 0, len(scope.columns)+1)
	for i := range scope.columns {
		ids = append(ids, rhsLaneColumnPrefix+strconv.Itoa(i))
	}
	return append(ids, rhsLaneOutside)
}

func rhsStatusList(ids []string) (string, error) {
	for _, id := range ids {
		if !rhsNumericID.MatchString(id) {
			return "", errors.Errorf("unexpected status id %q", id)
		}
	}
	return "(" + strings.Join(ids, ", ") + ")", nil
}

// rhsLaneClause is the JQL that limits a list to one column.
func rhsLaneClause(scope *rhsBoardScope, lane string) (string, error) {
	invalid := fmt.Errorf("%w: unknown column %q", ErrInvalidRHSBoard, lane)
	if scope == nil || len(scope.columns) == 0 {
		switch strings.TrimPrefix(lane, rhsLaneCategoryPrefix) {
		case statusCategoryKeyNew:
			// Like the webapp: anything neither in progress nor done.
			return "statusCategory not in (" + statusCategoryKeyIndeterminate + ", " + statusCategoryKeyDone + ")", nil
		case statusCategoryKeyIndeterminate:
			return "statusCategory = " + statusCategoryKeyIndeterminate, nil
		case statusCategoryKeyDone:
			return "statusCategory = " + statusCategoryKeyDone, nil
		}
		return "", invalid
	}
	if lane == rhsLaneOutside {
		all := []string{}
		for _, c := range scope.columns {
			all = append(all, c.StatusIDs...)
		}
		list, err := rhsStatusList(all)
		if err != nil {
			return "", err
		}
		return "status not in " + list, nil
	}
	index, err := strconv.Atoi(strings.TrimPrefix(lane, rhsLaneColumnPrefix))
	if !strings.HasPrefix(lane, rhsLaneColumnPrefix) || err != nil || index < 0 || index >= len(scope.columns) {
		return "", invalid
	}
	list, err := rhsStatusList(scope.columns[index].StatusIDs)
	if err != nil {
		return "", err
	}
	return "status in " + list, nil
}

// rhsLaneWhere returns the condition of a query without its order, or false
// when the query cannot be split in columns: a search by key, or a JQL with
// its own order.
func rhsLaneWhere(q *rhsFilteredQuery) (where, order string, ok bool) {
	if q.kind == rhsSearchKey || q.jql == "" {
		return "", "", false
	}
	order, err := rhsOrderBy(q.sort)
	if err != nil || !strings.HasSuffix(q.jql, order) {
		return "", "", false
	}
	where = strings.TrimSpace(strings.TrimSuffix(q.jql, order))
	return where, order, where != ""
}

// rhsLaneJQL limits a query to one column.
func rhsLaneJQL(q *rhsFilteredQuery, lane string) (string, error) {
	where, order, ok := rhsLaneWhere(q)
	if !ok {
		return "", fmt.Errorf("%w: this search cannot be split in columns", ErrInvalidRHSQuery)
	}
	clause, err := rhsLaneClause(q.scope, lane)
	if err != nil {
		return "", err
	}
	return "(" + where + ") AND " + clause + order, nil
}

// rhsLaneCategory is the status category of a column: in progress when any
// of its statuses is, otherwise that of its first status.
func rhsLaneCategory(scope *rhsBoardScope, lane string, categoryOf map[string]string) string {
	if key, ok := strings.CutPrefix(lane, rhsLaneCategoryPrefix); ok {
		return key
	}
	index, err := strconv.Atoi(strings.TrimPrefix(lane, rhsLaneColumnPrefix))
	if scope == nil || !strings.HasPrefix(lane, rhsLaneColumnPrefix) || err != nil || index < 0 || index >= len(scope.columns) {
		return ""
	}
	first := ""
	for _, id := range scope.columns[index].StatusIDs {
		key := categoryOf[id]
		if key == statusCategoryKeyIndeterminate {
			return key
		}
		if first == "" {
			first = key
		}
	}
	return first
}

// countRHSLanes asks Jira for the size of every column at once. categoryOf
// maps status ids to their category keys.
func countRHSLanes(q *rhsFilteredQuery, categoryOf map[string]string) (*RHSLanes, error) {
	ids := rhsLaneIDs(q.scope)
	result := &RHSLanes{Supported: true, Lanes: make([]RHSLaneCount, len(ids))}
	for i, id := range ids {
		result.Lanes[i] = RHSLaneCount{ID: id, CategoryKey: rhsLaneCategory(q.scope, id, categoryOf)}
	}
	if q.jql == "" {
		for i := range ids {
			zero := 0
			result.Lanes[i].Count = &zero
		}
		return result, nil
	}
	if _, _, ok := rhsLaneWhere(q); !ok {
		return &RHSLanes{Supported: false, Lanes: []RHSLaneCount{}}, nil
	}

	queries := make([]string, len(ids))
	for i, id := range ids {
		jql, err := rhsLaneJQL(q, id)
		if err != nil {
			return nil, err
		}
		queries[i] = jql
	}

	errs := make([]error, len(ids))
	var wg sync.WaitGroup
	for i, jql := range queries {
		wg.Add(1)
		go func(i int, jql string) {
			defer wg.Done()
			search, err := q.client.SearchJQL(CloudSearchParams{JQL: jql, Fields: []string{"key"}, MaxResults: 1})
			if err != nil {
				errs[i] = err
				return
			}
			result.Lanes[i].Count = search.Total
		}(i, jql)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			if restErr, badRequest := isJiraBadRequest(err); badRequest {
				return nil, fmt.Errorf("%w: %s", ErrInvalidRHSQuery, strings.TrimSpace(strings.TrimPrefix(restErr.Error(), " - ")))
			}
			return nil, err
		}
	}
	return result, nil
}

func (p *Plugin) httpRHSGetLanes(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	q, err := p.buildRHSFilteredQuery(rhsIssueQuery{
		instanceID:       types.ID(r.FormValue(ParamInstanceID)),
		mattermostUserID: userID,
		filter:           r.FormValue(queryRHSFilter),
		query:            r.FormValue(queryRHSQuery),
		sort:             r.FormValue(queryRHSSort),
		boardID:          r.FormValue(queryRHSBoardID),
	})
	if err != nil {
		return respondRHSErr(w, err)
	}
	categoryOf := map[string]string{}
	if entry, statusErr := p.getInstanceStatuses(q.instance.GetID(), userID, q.client); statusErr == nil {
		for _, status := range entry.statuses {
			if status != nil {
				categoryOf[status.ID] = status.StatusCategory.Key
			}
		}
	}
	lanes, err := countRHSLanes(q, categoryOf)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, lanes)
}
