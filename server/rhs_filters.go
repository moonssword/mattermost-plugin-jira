// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// RHSFilter is a quick filter of the "Мои задачи" section.
type RHSFilter string

const (
	RHSFilterAssigned RHSFilter = "assigned"
	RHSFilterReported RHSFilter = "reported"
	RHSFilterWatching RHSFilter = "watching"
	RHSFilterSprint   RHSFilter = "sprint"

	// RHSFilterBoard is what the board shows now: its active sprint, or on
	// Kanban its open and recently finished issues.
	RHSFilterBoard RHSFilter = "board"
)

const (
	queryRHSFilter = "filter"
	queryRHSQuery  = "q"

	rhsMaxQueryLength = 1000
)

// rhsSearchKind tells how the search box text was understood.
type rhsSearchKind string

const (
	rhsSearchNone rhsSearchKind = ""
	rhsSearchKey  rhsSearchKind = "key"
	rhsSearchText rhsSearchKind = "text"
	rhsSearchJQL  rhsSearchKind = "jql"
)

var (
	ErrInvalidRHSFilter = errors.New("invalid rhs filter")

	// ErrInvalidRHSQuery wraps a Jira 400 for a user-entered search, so the
	// webapp can show Jira's own message (usually a JQL syntax error).
	ErrInvalidRHSQuery = errors.New("invalid rhs query")

	rhsIssueKeyPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*-[0-9]+$`)
	rhsJQLPattern      = regexp.MustCompile(`(?i)(!=|!~|>=|<=|[=~<>])|\border\s+by\b|\bis\s+(not\s+)?empty\b|\b(not\s+)?in\s*\(`)
	rhsOrderByPattern  = regexp.MustCompile(`(?i)\border\s+by\b`)

	// Lucene special characters break `text ~` queries; they are dropped
	// because nobody searches for them in plain text.
	rhsTextSpecials = strings.NewReplacer(
		`\`, " ", `"`, " ", `'`, " ", "+", " ", "-", " ", "&", " ", "|", " ", "!", " ",
		"(", " ", ")", " ", "{", " ", "}", " ", "[", " ", "]", " ", "^", " ",
		"~", " ", "*", " ", "?", " ", ":", " ", "/", " ",
	)
)

func parseRHSFilter(s string) (RHSFilter, error) {
	switch RHSFilter(s) {
	case "", RHSFilterAssigned:
		return RHSFilterAssigned, nil
	case RHSFilterReported, RHSFilterWatching, RHSFilterSprint, RHSFilterBoard:
		return RHSFilter(s), nil
	default:
		return "", fmt.Errorf("%w: %q", ErrInvalidRHSFilter, s)
	}
}

// buildFilterJQL returns the JQL of a quick filter. Open issues only, except
// the sprint filter, where finished issues show sprint progress.
func buildFilterJQL(filter RHSFilter, sortField string, validCategoryKeys map[string]bool) (string, error) {
	order, err := rhsOrderBy(sortField)
	if err != nil {
		return "", err
	}

	var base string
	switch filter {
	case RHSFilterAssigned:
		base = "assignee = currentUser()"
	case RHSFilterReported:
		base = "reporter = currentUser()"
	case RHSFilterWatching:
		base = "watcher = currentUser()"
	case RHSFilterSprint:
		return "assignee = currentUser() AND sprint in openSprints()" + order, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrInvalidRHSFilter, filter)
	}

	if err := validateStatusCategoryOperand(statusCategoryKeyDone, validCategoryKeys); err != nil {
		return "", err
	}
	return base + " AND statusCategory != " + statusCategoryKeyDone + order, nil
}

// rhsBoardScope is the JQL of a board's own filter.
type rhsBoardScope struct {
	jql   string
	scrum bool

	// columns of the board view, as the board endpoint lists them.
	columns []RHSBoardColumn
}

type rhsBoardConfigClient interface {
	RESTGetRaw(endpoint string, params map[string]string, dest interface{}) error
}

var rhsNumericID = regexp.MustCompile(`^[0-9]+$`)

func loadRHSBoardScope(client rhsBoardConfigClient, boardID int) (*rhsBoardScope, error) {
	var cfg jiraAgileBoardConfig
	if err := client.RESTGetRaw(fmt.Sprintf("rest/agile/1.0/board/%d/configuration", boardID), nil, &cfg); err != nil {
		return nil, rhsJiraError(err)
	}
	if !rhsNumericID.MatchString(cfg.Filter.ID) {
		return nil, errors.Wrap(ErrInvalidRHSBoard, "the board has no filter")
	}
	scope := &rhsBoardScope{jql: "filter = " + cfg.Filter.ID, scrum: cfg.Type != "kanban", columns: rhsBoardColumns(&cfg)}
	if sub := strings.TrimSpace(cfg.SubQuery.Query); sub != "" {
		scope.jql += " AND (" + sub + ")"
	}
	return scope, nil
}

// buildBoardFilterJQL applies a quick filter inside the board.
func buildBoardFilterJQL(scope *rhsBoardScope, filter RHSFilter, sortField string, validCategoryKeys map[string]bool) (string, error) {
	if filter != RHSFilterBoard {
		jql, err := buildFilterJQL(filter, sortField, validCategoryKeys)
		if err != nil {
			return "", err
		}
		return scope.jql + " AND " + jql, nil
	}
	order, err := rhsOrderBy(sortField)
	if err != nil {
		return "", err
	}
	if scope.scrum {
		return scope.jql + " AND sprint in openSprints()" + order, nil
	}
	return scope.jql + " AND (statusCategory != " + statusCategoryKeyDone + " OR (" + rhsKanbanDoneJQL + "))" + order, nil
}

// classifyRHSQuery decides whether the search box holds an issue key, a JQL
// query or plain text.
func classifyRHSQuery(q string) rhsSearchKind {
	q = strings.TrimSpace(q)
	switch {
	case q == "":
		return rhsSearchNone
	case rhsIssueKeyPattern.MatchString(q):
		return rhsSearchKey
	case rhsJQLPattern.MatchString(q):
		return rhsSearchJQL
	default:
		return rhsSearchText
	}
}

func rhsTextTerms(q string) string {
	return strings.Join(strings.Fields(rhsTextSpecials.Replace(q)), " ")
}

// buildSearchJQL turns the search box into JQL. Searches cover every issue
// the user can see, not only the active quick filter. An empty string means
// nothing can match (for example only special characters were typed).
func buildSearchJQL(q, sortField string) (string, rhsSearchKind, error) {
	order, err := rhsOrderBy(sortField)
	if err != nil {
		return "", rhsSearchNone, err
	}
	q = strings.TrimSpace(q)
	if len(q) > rhsMaxQueryLength {
		return "", rhsSearchNone, fmt.Errorf("%w: query is too long", ErrInvalidRHSQuery)
	}

	kind := classifyRHSQuery(q)
	switch kind {
	case rhsSearchKey:
		return `key = "` + strings.ToUpper(q) + `"`, kind, nil
	case rhsSearchJQL:
		if rhsOrderByPattern.MatchString(q) {
			return q, kind, nil
		}
		return q + order, kind, nil
	case rhsSearchText:
		terms := rhsTextTerms(q)
		if terms == "" {
			return "", kind, nil
		}
		return `text ~ "` + terms + `"` + order, kind, nil
	default:
		return "", rhsSearchNone, nil
	}
}

type rhsIssueQuery struct {
	instanceID       types.ID
	mattermostUserID types.ID
	filter           string
	query            string
	sort             string
	nextPageToken    string

	// estimateField is the selected board's story points field, if any.
	estimateField string

	// boardID limits the list to the selected board. A search by text stays
	// inside it; a key or JQL is an explicit request and goes everywhere.
	boardID string

	// lane limits the list to one column of the board view.
	lane string
}

func isJiraBadRequest(err error) (RESTError, bool) {
	var restErr RESTError
	if errors.As(err, &restErr) && restErr.Status == http.StatusBadRequest {
		return restErr, true
	}
	return RESTError{}, false
}

// rhsFilteredQuery is the JQL of a quick filter or a search, with what was
// needed to build it.
type rhsFilteredQuery struct {
	instance Instance
	client   rhsClient
	filter   RHSFilter
	sort     string
	kind     rhsSearchKind
	scope    *rhsBoardScope

	// jql is empty when nothing can match.
	jql string
}

// buildRHSFilteredQuery builds the JQL of the quick filters and the search box.
func (p *Plugin) buildRHSFilteredQuery(params rhsIssueQuery) (*rhsFilteredQuery, error) {
	filter, err := parseRHSFilter(params.filter)
	if err != nil {
		return nil, err
	}
	sort := params.sort
	if sort == "" {
		sort = rhsDefaultSort
	}

	instance, client, err := p.resolveRHSUserClient(params.instanceID, params.mattermostUserID)
	if err != nil {
		return nil, err
	}

	var scope *rhsBoardScope
	if params.boardID != "" {
		boardID, boardErr := parseRHSBoardID(params.boardID)
		if boardErr != nil {
			return nil, boardErr
		}
		boardClient, ok := client.(rhsBoardConfigClient)
		if !ok {
			return nil, errors.Wrap(ErrInvalidRHSBoard, "boards are not available for this instance")
		}
		if scope, err = loadRHSBoardScope(boardClient, boardID); err != nil {
			return nil, err
		}
	}

	jql, kind, err := buildSearchJQL(params.query, sort)
	if err != nil {
		return nil, err
	}
	switch {
	case kind == rhsSearchNone:
		entry, statusErr := p.getInstanceStatuses(instance.GetID(), params.mattermostUserID, client)
		if statusErr != nil {
			return nil, statusErr
		}
		categories := validCategoryKeysFrom(entry.categories)
		if scope != nil {
			jql, err = buildBoardFilterJQL(scope, filter, sort, categories)
		} else {
			jql, err = buildFilterJQL(filter, sort, categories)
		}
		if err != nil {
			return nil, err
		}
	case kind == rhsSearchText && scope != nil && jql != "":
		jql = scope.jql + " AND " + jql
	}
	return &rhsFilteredQuery{instance: instance, client: client, filter: filter, sort: sort, kind: kind, scope: scope, jql: jql}, nil
}

// getRHSFilteredIssues serves the quick filters and the search box.
func (p *Plugin) getRHSFilteredIssues(params rhsIssueQuery) (*rhsIssuesResult, error) {
	q, err := p.buildRHSFilteredQuery(params)
	if err != nil {
		return nil, err
	}
	instance, client, kind, jql := q.instance, q.client, q.kind, q.jql
	openFirst := kind == rhsSearchNone && rhsOpenFirstFilter(q.filter)
	if params.lane != "" && jql != "" {
		// One column of the board view: its own order is enough.
		openFirst = false
		if jql, err = rhsLaneJQL(q, params.lane); err != nil {
			return nil, err
		}
	}

	empty := &rhsIssuesResult{Issues: []RHSIssue{}, Tabs: []RHSTabEntry{}, IsLast: true}
	if jql == "" {
		return empty, nil
	}

	estimateField, err := parseRHSEstimateField(params.estimateField)
	if err != nil {
		return nil, err
	}
	fields := rhsSearchFields
	if estimateField != "" {
		fields = append(append([]string{}, rhsSearchFields...), estimateField)
	}

	searchParams := CloudSearchParams{
		JQL:           jql,
		Fields:        fields,
		MaxResults:    rhsIssuesPageSize,
		NextPageToken: params.nextPageToken,
	}
	var search *CloudSearchResult
	if openFirst {
		search, err = searchRHSOpenFirstPage(client, searchParams, q.sort)
	} else {
		search, err = client.SearchJQL(searchParams)
	}
	if err != nil {
		restErr, badRequest := isJiraBadRequest(err)
		switch {
		case badRequest && kind == rhsSearchKey:
			// Jira rejects `key = X` when X does not exist: that is "not found".
			return empty, nil
		case badRequest:
			return nil, fmt.Errorf("%w: %s", ErrInvalidRHSQuery, strings.TrimSpace(strings.TrimPrefix(restErr.Error(), " - ")))
		default:
			return nil, err
		}
	}

	issues := normalizeRHSIssues(instance, search.Issues)
	applyRHSEstimates(issues, search.Issues, estimateField)
	return &rhsIssuesResult{
		Issues:        issues,
		Tabs:          []RHSTabEntry{},
		NextPageToken: search.NextPageToken,
		IsLast:        search.IsLast,
		Total:         search.Total,
	}, nil
}
