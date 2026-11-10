// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	jira "github.com/andygrunwald/go-jira"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Board endpoints of the RHS: the board picker, the sprint progress strip and
// the board view of "Мои задачи". They use the Jira Agile REST API, which is
// the same on Cloud and Server/DC. Every request acts as the connected user.
const (
	routeAPIRHSBoards           = "/rhs/boards"
	routeAPIRHSBoard            = "/rhs/board"
	routeAPIRHSIssueTransitions = "/rhs/issue/transitions"

	queryRHSBoardID   = "board_id"
	queryRHSBoardName = "q"

	rhsBoardsMax = 50

	// Sprint progress sums at most this many issues.
	rhsSprintIssuesPage     = 100
	rhsSprintIssuesMaxPages = 10

	// Kanban boards have no sprint: "done" counts issues finished recently.
	rhsKanbanDoneJQL = "statusCategory = done AND updated >= -14d"

	rhsProgressPoints = "points"
	rhsProgressIssues = "issues"
)

var (
	ErrInvalidRHSBoard = errors.New("invalid rhs board")

	// Only numeric custom fields hold story points; time estimates are not
	// summed, the strip then counts issues.
	rhsEstimateFieldPattern = regexp.MustCompile(`^customfield_[0-9]+$`)
)

func (p *Plugin) registerRHSBoardRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSBoards, p.checkAuth(p.handleResponse(p.httpRHSListBoards))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSBoard, p.checkAuth(p.handleResponse(p.httpRHSGetBoard))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSIssueTransitions, p.checkAuth(p.handleResponse(p.httpRHSIssueTransitions))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSIcon, p.checkAuth(p.handleResponse(p.httpRHSGetIcon))).Methods(http.MethodGet)
	p.registerRHSLaneRoutes(apiRouter)
}

// RHSBoardRef is one entry of the board picker.
type RHSBoardRef struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	ProjectKey  string `json:"projectKey,omitempty"`
	ProjectName string `json:"projectName,omitempty"`
}

type RHSBoardColumn struct {
	Name      string   `json:"name"`
	StatusIDs []string `json:"statusIds"`
}

type RHSSprint struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	StartDate string `json:"startDate,omitempty"`
	EndDate   string `json:"endDate,omitempty"`
}

// RHSBoardProgress splits the sprint (or, on Kanban, the board) by status
// category. Unit is "points" when the board estimates in story points.
type RHSBoardProgress struct {
	Unit       string  `json:"unit"`
	ToDo       float64 `json:"todo"`
	InProgress float64 `json:"inProgress"`
	Done       float64 `json:"done"`

	// Truncated is set when the sprint had more issues than were summed.
	Truncated bool `json:"truncated,omitempty"`
}

type RHSBoard struct {
	RHSBoardRef
	BrowseURL     string           `json:"browseUrl"`
	Columns       []RHSBoardColumn `json:"columns"`
	EstimateField string           `json:"estimateField,omitempty"`
	EstimateName  string           `json:"estimateName,omitempty"`

	// Sprint is the active sprint of a Scrum board, nil otherwise.
	Sprint   *RHSSprint        `json:"sprint,omitempty"`
	Progress *RHSBoardProgress `json:"progress,omitempty"`
}

type jiraAgileBoard struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Location *struct {
		ProjectKey  string `json:"projectKey"`
		ProjectName string `json:"projectName"`
	} `json:"location,omitempty"`
}

type jiraAgileBoardList struct {
	Values []jiraAgileBoard `json:"values"`
	IsLast bool             `json:"isLast"`
}

type jiraAgileBoardConfig struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Filter struct {
		ID string `json:"id"`
	} `json:"filter"`
	SubQuery struct {
		Query string `json:"query"`
	} `json:"subQuery"`
	ColumnConfig struct {
		Columns []struct {
			Name     string `json:"name"`
			Statuses []struct {
				ID string `json:"id"`
			} `json:"statuses"`
		} `json:"columns"`
	} `json:"columnConfig"`
	Estimation *struct {
		Type  string `json:"type"`
		Field *struct {
			FieldID     string `json:"fieldId"`
			DisplayName string `json:"displayName"`
		} `json:"field"`
	} `json:"estimation"`
}

type jiraAgileSprint struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	State     string `json:"state"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type jiraAgileSprintList struct {
	Values []jiraAgileSprint `json:"values"`
}

type jiraAgileIssues struct {
	Issues     []jira.Issue `json:"issues"`
	StartAt    int          `json:"startAt"`
	MaxResults int          `json:"maxResults"`
	Total      int          `json:"total"`
}

func parseRHSEstimateField(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", nil
	}
	if !rhsEstimateFieldPattern.MatchString(s) {
		return "", errors.Wrapf(ErrInvalidRHSBoard, "invalid estimate field %q", s)
	}
	return s, nil
}

func parseRHSBoardID(s string) (int, error) {
	id, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || id <= 0 {
		return 0, errors.Wrapf(ErrInvalidRHSBoard, "invalid board id %q", s)
	}
	return id, nil
}

// rhsEstimate reads a numeric custom field; Jira returns null when unset.
func rhsEstimate(issue jira.Issue, field string) *float64 {
	if field == "" || issue.Fields == nil || issue.Fields.Unknowns == nil {
		return nil
	}
	switch v := issue.Fields.Unknowns[field].(type) {
	case float64:
		return &v
	case int:
		f := float64(v)
		return &f
	default:
		return nil
	}
}

// applyRHSEstimates copies the estimation field onto normalized issues; both
// slices come from the same search, in the same order.
func applyRHSEstimates(out []RHSIssue, issues []jira.Issue, field string) {
	if field == "" {
		return
	}
	for i := range out {
		if i < len(issues) {
			out[i].Estimate = rhsEstimate(issues[i], field)
		}
	}
}

func rhsBoardBrowseURL(instance Instance, boardID int) string {
	return strings.TrimRight(instance.GetJiraBaseURL(), "/") + "/secure/RapidBoard.jspa?rapidView=" + strconv.Itoa(boardID)
}

func toRHSBoardRef(b jiraAgileBoard) RHSBoardRef {
	ref := RHSBoardRef{ID: b.ID, Name: b.Name, Type: b.Type}
	if b.Location != nil {
		ref.ProjectKey = b.Location.ProjectKey
		ref.ProjectName = b.Location.ProjectName
	}
	return ref
}

func (p *Plugin) listRHSBoards(client Client, name string) ([]RHSBoardRef, error) {
	params := map[string]string{"maxResults": strconv.Itoa(rhsBoardsMax)}
	if name = strings.TrimSpace(name); name != "" {
		params["name"] = name
	}
	var list jiraAgileBoardList
	if err := client.RESTGetRaw("rest/agile/1.0/board", params, &list); err != nil {
		return nil, rhsJiraError(err)
	}
	out := make([]RHSBoardRef, 0, len(list.Values))
	for _, b := range list.Values {
		out = append(out, toRHSBoardRef(b))
	}
	return out, nil
}

// rhsBoardColumns drops columns without statuses (the Kanban backlog column
// on Server/DC has none).
func rhsBoardColumns(cfg *jiraAgileBoardConfig) []RHSBoardColumn {
	out := []RHSBoardColumn{}
	for _, c := range cfg.ColumnConfig.Columns {
		ids := make([]string, 0, len(c.Statuses))
		for _, s := range c.Statuses {
			if s.ID != "" {
				ids = append(ids, s.ID)
			}
		}
		if len(ids) == 0 {
			continue
		}
		out = append(out, RHSBoardColumn{Name: c.Name, StatusIDs: ids})
	}
	return out
}

func rhsBoardEstimate(cfg *jiraAgileBoardConfig) (fieldID, name string) {
	if cfg.Estimation == nil || cfg.Estimation.Field == nil {
		return "", ""
	}
	if !rhsEstimateFieldPattern.MatchString(cfg.Estimation.Field.FieldID) {
		return "", ""
	}
	return cfg.Estimation.Field.FieldID, cfg.Estimation.Field.DisplayName
}

func addRHSProgress(progress *RHSBoardProgress, categoryKey string, value float64) {
	switch categoryKey {
	case statusCategoryKeyDone:
		progress.Done += value
	case statusCategoryKeyIndeterminate:
		progress.InProgress += value
	default:
		progress.ToDo += value
	}
}

// sprintProgress sums the sprint's issues by status category, in story points
// when the board has an estimation field, otherwise in issues.
func sprintProgress(client Client, boardID, sprintID int, estimateField string) (*RHSBoardProgress, error) {
	progress := &RHSBoardProgress{Unit: rhsProgressIssues}
	if estimateField != "" {
		progress.Unit = rhsProgressPoints
	}
	// counts is the same split in issues, used when nobody estimated.
	counts := &RHSBoardProgress{Unit: rhsProgressIssues}
	finish := func(truncated bool) *RHSBoardProgress {
		if progress.Unit == rhsProgressPoints && progress.ToDo+progress.InProgress+progress.Done == 0 {
			progress = counts
		}
		progress.Truncated = truncated
		return progress
	}
	fields := "status"
	if estimateField != "" {
		fields += "," + estimateField
	}
	endpoint := fmt.Sprintf("rest/agile/1.0/board/%d/sprint/%d/issue", boardID, sprintID)
	startAt := 0
	for page := 0; page < rhsSprintIssuesMaxPages; page++ {
		var res jiraAgileIssues
		err := client.RESTGetRaw(endpoint, map[string]string{
			"fields":     fields,
			"maxResults": strconv.Itoa(rhsSprintIssuesPage),
			"startAt":    strconv.Itoa(startAt),
		}, &res)
		if err != nil {
			return nil, rhsJiraError(err)
		}
		for _, issue := range res.Issues {
			category := ""
			if issue.Fields != nil && issue.Fields.Status != nil {
				category = issue.Fields.Status.StatusCategory.Key
			}
			addRHSProgress(counts, category, 1)
			value := 1.0
			if estimateField != "" {
				value = 0
				if est := rhsEstimate(issue, estimateField); est != nil {
					value = *est
				}
			}
			addRHSProgress(progress, category, value)
		}
		startAt += len(res.Issues)
		if len(res.Issues) == 0 || startAt >= res.Total {
			return finish(false), nil
		}
	}
	return finish(true), nil
}

// kanbanProgress counts the board's issues per status category with three
// count-only queries.
// kanbanProgress counts the board's issues by category. subQuery is the
// board's Kanban sub-filter: the board API leaves it out, Jira's board and
// the list in the panel apply it.
func kanbanProgress(client Client, boardID int, subQuery string) (*RHSBoardProgress, error) {
	progress := &RHSBoardProgress{Unit: rhsProgressIssues}
	endpoint := fmt.Sprintf("rest/agile/1.0/board/%d/issue", boardID)
	prefix := ""
	if sub := strings.TrimSpace(subQuery); sub != "" {
		prefix = "(" + sub + ") AND "
	}
	queries := []struct {
		jql string
		dst *float64
	}{
		{"statusCategory = " + statusCategoryKeyNew, &progress.ToDo},
		{"statusCategory = " + statusCategoryKeyIndeterminate, &progress.InProgress},
		{rhsKanbanDoneJQL, &progress.Done},
	}
	for _, q := range queries {
		var res jiraAgileIssues
		err := client.RESTGetRaw(endpoint, map[string]string{
			"jql":        prefix + q.jql,
			"fields":     "status",
			"maxResults": "1",
		}, &res)
		if err != nil {
			return nil, rhsJiraError(err)
		}
		*q.dst = float64(res.Total)
	}
	return progress, nil
}

func activeSprint(client Client, boardID int) (*jiraAgileSprint, error) {
	var list jiraAgileSprintList
	err := client.RESTGetRaw(fmt.Sprintf("rest/agile/1.0/board/%d/sprint", boardID), map[string]string{"state": "active"}, &list)
	if err != nil {
		return nil, rhsJiraError(err)
	}
	if len(list.Values) == 0 {
		return nil, nil
	}
	return &list.Values[0], nil
}

// rhsAgileTime normalizes Jira's sprint dates to RFC 3339.
func rhsAgileTime(s string) string {
	if s == "" {
		return ""
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000-0700", "2006-01-02T15:04:05-0700"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
	}
	return ""
}

func (p *Plugin) loadRHSBoard(instance Instance, client Client, boardID int) (*RHSBoard, error) {
	var cfg jiraAgileBoardConfig
	if err := client.RESTGetRaw(fmt.Sprintf("rest/agile/1.0/board/%d/configuration", boardID), nil, &cfg); err != nil {
		return nil, rhsJiraError(err)
	}
	var meta jiraAgileBoard
	if err := client.RESTGetRaw(fmt.Sprintf("rest/agile/1.0/board/%d", boardID), nil, &meta); err != nil {
		return nil, rhsJiraError(err)
	}

	board := &RHSBoard{
		RHSBoardRef: toRHSBoardRef(meta),
		BrowseURL:   rhsBoardBrowseURL(instance, boardID),
		Columns:     rhsBoardColumns(&cfg),
	}
	if board.Name == "" {
		board.Name = cfg.Name
	}
	board.EstimateField, board.EstimateName = rhsBoardEstimate(&cfg)

	if board.Type == "kanban" {
		progress, err := kanbanProgress(client, boardID, cfg.SubQuery.Query)
		if err != nil {
			return nil, err
		}
		board.Progress = progress
		return board, nil
	}

	sprint, err := activeSprint(client, boardID)
	if err != nil {
		return nil, err
	}
	if sprint == nil {
		return board, nil
	}
	board.Sprint = &RHSSprint{
		ID:        sprint.ID,
		Name:      sprint.Name,
		StartDate: rhsAgileTime(sprint.StartDate),
		EndDate:   rhsAgileTime(sprint.EndDate),
	}
	progress, err := sprintProgress(client, boardID, sprint.ID, board.EstimateField)
	if err != nil {
		return nil, err
	}
	progress.ToDo = roundRHSPoints(progress.ToDo)
	progress.InProgress = roundRHSPoints(progress.InProgress)
	progress.Done = roundRHSPoints(progress.Done)
	board.Progress = progress
	return board, nil
}

func roundRHSPoints(v float64) float64 {
	return math.Round(v*10) / 10
}

func (p *Plugin) rhsBoardClient(r *http.Request) (Instance, Client, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	instanceID := types.ID(r.FormValue(ParamInstanceID))
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return nil, nil, err
	}
	client, instance, _, err := p.getRHSClient(instanceID, userID)
	if err != nil {
		return nil, nil, err
	}
	return instance, client, nil
}

func (p *Plugin) httpRHSListBoards(w http.ResponseWriter, r *http.Request) (int, error) {
	_, client, err := p.rhsBoardClient(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	boards, err := p.listRHSBoards(client, r.FormValue(queryRHSBoardName))
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, map[string]interface{}{"boards": boards})
}

func (p *Plugin) httpRHSGetBoard(w http.ResponseWriter, r *http.Request) (int, error) {
	boardID, err := parseRHSBoardID(r.FormValue(queryRHSBoardID))
	if err != nil {
		return respondRHSErr(w, err)
	}
	instance, client, err := p.rhsBoardClient(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	board, err := p.loadRHSBoard(instance, client, boardID)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, board)
}

// httpRHSIssueTransitions lists the transitions of one issue, for the
// "next column" button on board cards.
func (p *Plugin) httpRHSIssueTransitions(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	transitions, err := ctx.client.GetTransitions(ctx.key)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	out := make([]RHSTransition, 0, len(transitions))
	for _, t := range transitions {
		out = append(out, RHSTransition{
			ID:   t.ID,
			Name: t.Name,
			To:   RHSIssueStatus{ID: t.To.ID, Name: t.To.Name, CategoryKey: t.To.StatusCategory.Key},
		})
	}
	return respondJSON(w, map[string]interface{}{"transitions": out})
}
