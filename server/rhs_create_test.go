// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func newCreateIssueTestPlugin(api *plugintest.API) *Plugin {
	api.On("SendEphemeralPost", mock.AnythingOfType("string"), mock.AnythingOfType("*model.Post")).Return(&model.Post{})
	api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(&model.Post{}, (*model.AppError)(nil))
	api.On("PublishWebSocketEvent", "update_defaults", mock.AnythingOfType("map[string]interface {}"), mock.AnythingOfType("*model.WebsocketBroadcast"))
	api.On("LogError", mockAnythingOfTypeBatch("string", 13)...).Return().Maybe()

	p := &Plugin{}
	p.initializeRouter()
	p.SetAPI(api)
	p.client = pluginapi.NewClient(api, p.Driver)
	p.updateConfig(func(conf *config) {
		conf.mattermostSiteURL = "https://somelink.com"
	})
	p.userStore = getMockUserStoreKV()
	p.instanceStore = p.getMockInstanceStoreKV(1)
	return p
}

func rhsCreateInput(skip bool) *InCreateIssue {
	return &InCreateIssue{
		CurrentTeam:      "test_team",
		ChannelID:        "channel_id_1",
		mattermostUserID: "connected_user",
		InstanceID:       testInstance1.InstanceID,
		SkipPublicReply:  skip,
		Fields: jira.IssueFields{
			Project: jira.Project{Key: mockProjectKey},
			Type:    jira.IssueType{ID: "10001"},
			Summary: "Test Issue",
		},
	}
}

func TestCreateIssueSkipPublicReply(t *testing.T) {
	api := &plugintest.API{}
	p := newCreateIssueTestPlugin(api)

	issue, status, err := p.CreateIssue(rhsCreateInput(true))
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
	assert.NotNil(t, issue)
	api.AssertNotCalled(t, "CreatePost", mock.Anything)
	api.AssertCalled(t, "SendEphemeralPost", "connected_user", mock.AnythingOfType("*model.Post"))
}

func TestCreateIssueKeepsPublicReplyByDefault(t *testing.T) {
	api := &plugintest.API{}
	p := newCreateIssueTestPlugin(api)

	_, _, err := p.CreateIssue(rhsCreateInput(false))
	require.NoError(t, err)
	api.AssertNumberOfCalls(t, "CreatePost", 1)
}
