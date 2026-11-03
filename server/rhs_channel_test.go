// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const rhsTestChannel = "channelaaaaaaaaaaaaaaaaaaa"

func rhsTestSubs() []ChannelSubscription {
	return []ChannelSubscription{
		{
			ID: "sub1", ChannelID: rhsTestChannel, Name: "Баги бэкенда", InstanceID: mockInstance1URL,
			Filters: SubscriptionFilters{Events: NewStringSet("event_created"), Projects: NewStringSet("BACK"), IssueTypes: NewStringSet("10001")},
		},
		{
			ID: "sub2", ChannelID: rhsTestChannel, Name: "Релиз", InstanceID: mockInstance1URL,
			Paused: true, PausedAt: 1700000000000, PausedBy: "anna",
			Filters: SubscriptionFilters{Events: NewStringSet("event_updated_status"), Projects: NewStringSet("BACK"), IssueTypes: NewStringSet("10001")},
		},
		{
			ID: "other", ChannelID: "otherchannelaaaaaaaaaaaaaa", Name: "Чужая", InstanceID: mockInstance1URL,
			Filters: SubscriptionFilters{Events: NewStringSet("event_created"), Projects: NewStringSet("BACK"), IssueTypes: NewStringSet("10001")},
		},
	}
}

func setupRHSChannelPlugin(t *testing.T, api *plugintest.API, roles string) *Plugin {
	t.Helper()
	p := setupRHSHTTPPlugin(t, api)
	p.updateConfig(func(conf *config) {
		conf.RolesAllowedToEditJiraSubscriptions = roles
	})
	raw, err := json.Marshal(withExistingChannelSubscriptions(rhsTestSubs()))
	require.NoError(t, err)
	api.On("KVGet", testSubKey).Return(raw, nil)
	return p
}

func TestRHSChannelSubscriptionsList(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSChannelPlugin(t, api, "system_admin")
	api.On("GetChannelMember", rhsTestChannel, "member").Return(&model.ChannelMember{}, nil)
	api.On("HasPermissionTo", "member", model.PermissionManageSystem).Return(false)
	api.On("GetUser", "anna").Return(&model.User{Username: "anna", FirstName: "Анна", LastName: "Смирнова"}, nil)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSChannelSubscriptions)+"?instance_id="+url.QueryEscape(mockInstance1URL)+"&channel_id="+rhsTestChannel, "member")
	require.Equal(t, http.StatusOK, w.Result().StatusCode, w.Body.String())

	var body rhsChannelSubscriptionsResult
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.False(t, body.CanManage)
	require.Len(t, body.Subscriptions, 2)
	assert.Equal(t, "Баги бэкенда", body.Subscriptions[0].Name)
	assert.True(t, body.Subscriptions[1].Paused)
	assert.Equal(t, "Анна Смирнова", body.Subscriptions[1].PausedByName)
}

func TestRHSChannelSubscriptionsRequiresMembership(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSChannelPlugin(t, api, "users")
	api.On("GetChannelMember", rhsTestChannel, "stranger").Return(nil, &model.AppError{Message: "not found"})

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSChannelSubscriptions)+"?instance_id="+url.QueryEscape(mockInstance1URL)+"&channel_id="+rhsTestChannel, "stranger")
	assert.Equal(t, http.StatusForbidden, w.Result().StatusCode)
	assert.Equal(t, rhsErrForbidden, decodeRHSError(t, w).Error)
}

func TestRHSPauseSubscriptionNeedsPermission(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSChannelPlugin(t, api, "system_admin")
	api.On("GetChannelMember", rhsTestChannel, "member").Return(&model.ChannelMember{}, nil)
	api.On("HasPermissionTo", "member", model.PermissionManageSystem).Return(false)

	w := doRHSHTTPPostAs(t, p, routeAPIRHSSubscriptionPause, "member", rhsPauseRequest{InstanceID: mockInstance1URL, ChannelID: rhsTestChannel, SubscriptionID: "sub1", Paused: true})
	assert.Equal(t, http.StatusForbidden, w.Result().StatusCode)
	api.AssertNotCalled(t, "KVSetWithOptions", mock.Anything, mock.Anything, mock.Anything)
}

func TestSetChannelSubscriptionPaused(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSChannelPlugin(t, api, "users")
	now := time.UnixMilli(1762000000000)

	var saved Subscriptions
	api.On("KVSetWithOptions", testSubKey, mock.MatchedBy(func(data []byte) bool {
		return json.Unmarshal(data, &saved) == nil
	}), mock.AnythingOfType("model.PluginKVSetOptions")).Return(true, nil)

	require.NoError(t, p.setChannelSubscriptionPaused(mockInstance1URL, rhsTestChannel, "sub1", "ivan", true, now))
	sub := saved.Channel.ByID["sub1"]
	assert.True(t, sub.Paused)
	assert.Equal(t, now.UnixMilli(), sub.PausedAt)
	assert.Equal(t, "ivan", sub.PausedBy)
	assert.True(t, saved.Channel.IDByChannelID[rhsTestChannel].ContainsAny("sub1"))

	require.NoError(t, p.setChannelSubscriptionPaused(mockInstance1URL, rhsTestChannel, "sub2", "ivan", false, now))
	assert.False(t, saved.Channel.ByID["sub2"].Paused)
	assert.Zero(t, saved.Channel.ByID["sub2"].PausedAt)

	err := p.setChannelSubscriptionPaused(mockInstance1URL, rhsTestChannel, "other", "ivan", true, now)
	assert.Error(t, err, "a subscription of another channel cannot be paused from here")
}

func TestGetChannelsSubscribedSkipsPaused(t *testing.T) {
	filters := SubscriptionFilters{Events: NewStringSet("event_created"), Projects: NewStringSet("TES"), IssueTypes: NewStringSet("10001")}
	subs := withExistingChannelSubscriptions([]ChannelSubscription{
		{ID: "active", ChannelID: "activechannel", InstanceID: mockInstance1URL, Filters: filters},
		{ID: "paused", ChannelID: "pausedchannel", InstanceID: mockInstance1URL, Filters: filters, Paused: true},
	})
	raw, err := json.Marshal(subs)
	require.NoError(t, err)

	api := &plugintest.API{}
	api.On("KVGet", testSubKey).Return(raw, nil)
	p := &Plugin{}
	p.updateConfig(func(conf *config) {
		conf.Secret = someSecret
	})
	p.SetAPI(api)
	p.client = pluginapi.NewClient(api, p.Driver)
	p.instanceStore = p.getMockInstanceStoreKV(0)

	data, err := getJiraTestData("webhook-issue-created.json")
	require.NoError(t, err)
	wh, err := ParseWebhook(data)
	require.NoError(t, err)

	channels, err := p.getChannelsSubscribed(wh.(*webhook), testInstance1.InstanceID)
	require.NoError(t, err)
	require.Len(t, channels, 1)
	assert.Equal(t, "activechannel", channels[0].ChannelID)
}

func TestEditChannelSubscriptionKeepsPause(t *testing.T) {
	filters := SubscriptionFilters{Events: NewStringSet("event_created"), Projects: NewStringSet("TES"), IssueTypes: NewStringSet("10001")}
	existing := withExistingChannelSubscriptions([]ChannelSubscription{
		{ID: "s", ChannelID: rhsTestChannel, InstanceID: mockInstance1URL, Name: "old", Filters: filters, Paused: true, PausedAt: 5, PausedBy: "anna"},
	})
	raw, err := json.Marshal(existing)
	require.NoError(t, err)

	api := &plugintest.API{}
	api.On("KVGet", testSubKey).Return(raw, nil)
	var saved Subscriptions
	api.On("KVSetWithOptions", testSubKey, mock.MatchedBy(func(data []byte) bool {
		return json.Unmarshal(data, &saved) == nil
	}), mock.AnythingOfType("model.PluginKVSetOptions")).Return(true, nil)
	p := &Plugin{}
	p.SetAPI(api)
	p.client = pluginapi.NewClient(api, p.Driver)
	p.instanceStore = p.getMockInstanceStoreKV(1)

	edited := &ChannelSubscription{ID: "s", ChannelID: rhsTestChannel, InstanceID: mockInstance1URL, Name: "new", Filters: filters}
	require.NoError(t, p.editChannelSubscription(mockInstance1URL, edited, testClient{}))

	sub := saved.Channel.ByID["s"]
	assert.Equal(t, "new", sub.Name)
	assert.True(t, sub.Paused)
	assert.Equal(t, int64(5), sub.PausedAt)
	assert.Equal(t, "anna", sub.PausedBy)
}
