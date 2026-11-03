// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"errors"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

type rhsMappingUserStore struct {
	mockUserStore
	byJira map[string]types.ID
}

func (s rhsMappingUserStore) LoadMattermostUserID(_ types.ID, key string) (types.ID, error) {
	if id, ok := s.byJira[key]; ok {
		return id, nil
	}
	return "", errors.New("not connected")
}

func rhsLiveWebhook() *webhook {
	wh := &webhook{JiraWebhook: &JiraWebhook{WebhookEvent: "jira:issue_updated"}}
	wh.Issue = jira.Issue{Key: "BACK-412", Fields: &jira.IssueFields{
		Assignee: &jira.User{Name: "dk"},
		Reporter: &jira.User{AccountID: "acc-anna", Name: "anna"},
	}}
	wh.ChangeLog.Items = append(wh.ChangeLog.Items, struct {
		From       string
		FromString string
		To         string
		ToString   string
		Field      string
		FieldID    string
		FieldType  string `json:"fieldtype"`
	}{Field: "assignee", From: "ivan", To: "dk"}, struct {
		From       string
		FromString string
		To         string
		ToString   string
		Field      string
		FieldID    string
		FieldType  string `json:"fieldtype"`
	}{Field: "status", From: "1", To: "3"})
	wh.notifications = []webhookUserNotification{{jiraUsername: "watcher"}, {jiraAccountID: "acc-mentioned", jiraUsername: "ignored"}}
	return wh
}

func TestRHSIssueAudience(t *testing.T) {
	got := rhsIssueAudience(rhsLiveWebhook())
	assert.ElementsMatch(t, []string{"watcher", "acc-mentioned", "dk", "acc-anna", "ivan", "dk"}, got)
}

func TestPublishRHSIssueChangedTargetsConnectedUsersOnce(t *testing.T) {
	api := &plugintest.API{}
	p := &Plugin{}
	p.SetAPI(api)
	p.client = pluginapi.NewClient(api, p.Driver)
	p.userStore = rhsMappingUserStore{byJira: map[string]types.ID{
		"dk": "mm-dk", "acc-anna": "mm-anna", "ivan": "mm-ivan", "watcher": "mm-watcher",
	}}

	var targets []string
	api.On("PublishWebSocketEvent", websocketEventRHSIssueChanged, mock.MatchedBy(func(payload map[string]interface{}) bool {
		return payload["issue_key"] == "BACK-412" && payload["instance_id"] == "http://jira.example.com" && len(payload) == 3
	}), mock.MatchedBy(func(b *model.WebsocketBroadcast) bool {
		targets = append(targets, b.UserId)
		return b.UserId != "" && b.ChannelId == "" && b.TeamId == ""
	})).Return()

	p.publishRHSIssueChanged(rhsLiveWebhook(), "http://jira.example.com")

	assert.ElementsMatch(t, []string{"mm-watcher", "mm-dk", "mm-anna", "mm-ivan"}, targets, "each connected user once, unknown users skipped")
}

func TestPublishRHSIssueChangedSkipsEventsWithoutIssue(t *testing.T) {
	api := &plugintest.API{}
	p := &Plugin{}
	p.SetAPI(api)
	p.client = pluginapi.NewClient(api, p.Driver)

	p.publishRHSIssueChanged(&webhook{JiraWebhook: &JiraWebhook{}}, "http://jira.example.com")
	p.publishRHSIssueChanged(nil, "http://jira.example.com")
	api.AssertNotCalled(t, "PublishWebSocketEvent", mock.Anything, mock.Anything, mock.Anything)
}
