// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
	"time"

	jira "github.com/andygrunwald/go-jira"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/kvstore"
	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

const rhsIssuesPageSize = 20

var rhsSearchFields = []string{
	"summary", "status", "issuetype", "updated", "project", "created", "duedate", "priority", "assignee",
}

// rhsClient is the RHS API implemented by both the Cloud and the Server/DC
// clients. Do not add these methods to Client.
type rhsClient interface {
	rhsStatusLister
	SearchJQL(params CloudSearchParams) (*CloudSearchResult, error)
}

func (p *Plugin) loadRHSInstance(instanceID types.ID) (Instance, error) {
	if instanceID == "" {
		return nil, errors.Wrap(ErrInvalidRHSTab, "instance_id is required")
	}
	instance, err := p.instanceStore.LoadInstance(instanceID)
	if err != nil {
		if errors.Is(err, kvstore.ErrNotFound) {
			return nil, errors.Wrap(ErrInvalidRHSTab, "unknown instance_id")
		}
		return nil, err
	}
	return instance, nil
}

// getRHSClient is getClient for RHS endpoints. A user without a stored
// token gets kvstore.ErrNotFound, which the RHS reports as "not_connected"
// instead of an internal error. The extra lookup runs only on failure.
func (p *Plugin) getRHSClient(instanceID, mattermostUserID types.ID) (Client, Instance, *Connection, error) {
	client, instance, connection, err := p.getClient(instanceID, mattermostUserID)
	if err == nil {
		return client, instance, connection, nil
	}
	if rhsNotConnected(p.userStore.LoadConnection(instanceID, mattermostUserID)) {
		return nil, nil, nil, errors.Wrap(kvstore.ErrNotFound, err.Error())
	}
	return nil, nil, nil, err
}

// rhsNotConnected tells whether a stored connection holds no Jira token.
func rhsNotConnected(stored *Connection, loadErr error) bool {
	if loadErr != nil {
		return errors.Is(loadErr, kvstore.ErrNotFound)
	}
	return stored == nil || (stored.Oauth1AccessToken == "" && stored.OAuth2Token == nil)
}

func (p *Plugin) resolveRHSUserClient(instanceID, mattermostUserID types.ID) (Instance, rhsClient, error) {
	instance, err := p.loadRHSInstance(instanceID)
	if err != nil {
		return nil, nil, err
	}

	client, instance, _, err := p.getRHSClient(instance.GetID(), mattermostUserID)
	if err != nil {
		return nil, nil, err
	}
	rhs, ok := client.(rhsClient)
	if !ok {
		return nil, nil, ErrRHSUnsupportedInstance
	}
	return instance, rhs, nil
}

func (p *Plugin) resolveRHSAdminClient(instance Instance, adminUserID types.ID) (rhsClient, error) {
	switch inst := instance.(type) {
	case *cloudInstance:
		raw, err := inst.getClientForBot()
		if err != nil {
			return nil, err
		}
		rhs, ok := newCloudClient(raw).(rhsClient)
		if !ok {
			return nil, ErrRHSUnsupportedInstance
		}
		return rhs, nil

	default:
		// Cloud OAuth and Server/DC act on behalf of the admin's own connection.
		connection, err := p.userStore.LoadConnection(instance.GetID(), adminUserID)
		if err != nil {
			return nil, err
		}
		client, err := instance.GetClient(connection)
		if err != nil {
			return nil, err
		}
		rhs, ok := client.(rhsClient)
		if !ok {
			return nil, ErrRHSUnsupportedInstance
		}
		return rhs, nil
	}
}

func rhsBrowseURL(instance Instance, issueKey string) string {
	return strings.TrimRight(instance.GetJiraBaseURL(), "/") + "/browse/" + issueKey
}

func rhsTimeRFC3339(t jira.Time) string {
	tt := time.Time(t)
	if tt.IsZero() {
		return ""
	}
	return tt.UTC().Format(time.RFC3339)
}

func normalizeRHSIssue(instance Instance, issue jira.Issue) RHSIssue {
	out := RHSIssue{
		Key:       issue.Key,
		BrowseURL: rhsBrowseURL(instance, issue.Key),
	}
	if issue.Fields == nil {
		return out
	}
	f := issue.Fields
	out.Summary = f.Summary
	out.IssueType = f.Type.Name
	out.IssueTypeIconURL = rhsIconURL(instance, f.Type.IconURL)
	out.Project = f.Project.Key
	out.Updated = rhsTimeRFC3339(f.Updated)
	out.Created = rhsTimeRFC3339(f.Created)
	if due := time.Time(f.Duedate); !due.IsZero() {
		out.DueDate = due.Format("2006-01-02")
	}
	if f.Priority != nil {
		out.Priority = f.Priority.Name
		out.PriorityIconURL = rhsIconURL(instance, f.Priority.IconURL)
	}
	if f.Assignee != nil {
		out.AssigneeName = f.Assignee.DisplayName
		out.AssigneeAvatarURL = rhsUserAvatarURL(instance, f.Assignee)
	}
	if f.Status != nil {
		out.Status = RHSIssueStatus{
			ID:          f.Status.ID,
			Name:        f.Status.Name,
			CategoryKey: f.Status.StatusCategory.Key,
		}
	}
	return out
}

func normalizeRHSIssues(instance Instance, issues []jira.Issue) []RHSIssue {
	out := make([]RHSIssue, 0, len(issues))
	for _, issue := range issues {
		out = append(out, normalizeRHSIssue(instance, issue))
	}
	return out
}

func pickRHSTab(tabs []RHSTabEntry, identity string) RHSTabEntry {
	parsed, err := parseRHSTabIdentity(identity)
	if err != nil {
		return rhsAssignedTab()
	}
	want := rhsTabIdentity(parsed)
	for _, tab := range tabs {
		if rhsTabIdentity(tab) == want {
			return tab
		}
	}
	return rhsAssignedTab()
}

type rhsIssuesResult struct {
	Issues        []RHSIssue    `json:"issues"`
	Tabs          []RHSTabEntry `json:"tabs"`
	NextPageToken string        `json:"nextPageToken"`
	IsLast        bool          `json:"isLast"`
	Total         *int          `json:"total,omitempty"`
}

func (p *Plugin) getRHSIssues(instanceID, mattermostUserID types.ID, tabIdentity, sort, nextPageToken string) (*rhsIssuesResult, error) {
	instance, client, err := p.resolveRHSUserClient(instanceID, mattermostUserID)
	if err != nil {
		return nil, err
	}

	entry, err := p.getInstanceStatuses(instance.GetID(), mattermostUserID, client)
	if err != nil {
		return nil, err
	}

	conf := p.getConfig()
	configured := conf.RHSStatusTabs[string(instance.GetID())]
	tabs := resolveTabs(configured, entry.statuses, entry.categories)

	selected := pickRHSTab(tabs, tabIdentity)
	if sort == "" {
		sort = rhsDefaultSort
	}

	jql, err := buildTabJQL(selected, sort, validCategoryKeysFrom(entry.categories))
	if err != nil {
		return nil, err
	}

	search, err := client.SearchJQL(CloudSearchParams{
		JQL:           jql,
		Fields:        rhsSearchFields,
		MaxResults:    rhsIssuesPageSize,
		NextPageToken: nextPageToken,
	})
	if err != nil {
		return nil, err
	}

	return &rhsIssuesResult{
		Issues:        normalizeRHSIssues(instance, search.Issues),
		Tabs:          tabs,
		NextPageToken: search.NextPageToken,
		IsLast:        search.IsLast,
	}, nil
}

type rhsStatusesResult struct {
	Statuses   []*JiraStatus         `json:"statuses"`
	Categories []*JiraStatusCategory `json:"categories"`
}

func (p *Plugin) getRHSStatuses(instanceID, adminUserID types.ID) (*rhsStatusesResult, error) {
	instance, err := p.loadRHSInstance(instanceID)
	if err != nil {
		return nil, err
	}

	client, err := p.resolveRHSAdminClient(instance, adminUserID)
	if err != nil {
		return nil, err
	}

	entry, err := p.getInstanceStatuses(instance.GetID(), rhsAdminStatusCacheUserID(instance, adminUserID), client)
	if err != nil {
		return nil, err
	}
	p.enrichStatusesWithProjects(client, entry.statuses)
	return &rhsStatusesResult{
		Statuses:   entry.statuses,
		Categories: entry.categories,
	}, nil
}
