// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

type memoryConnectionStore struct {
	mockUserStore
	connection *Connection
}

func (s *memoryConnectionStore) LoadConnection(types.ID, types.ID) (*Connection, error) {
	copied := *s.connection
	if s.connection.Settings != nil {
		settings := *s.connection.Settings
		settings.RolesForDMNotification = map[string]bool{}
		for k, v := range s.connection.Settings.RolesForDMNotification {
			settings.RolesForDMNotification[k] = v
		}
		copied.Settings = &settings
	}
	return &copied, nil
}

func (s *memoryConnectionStore) StoreConnection(_, _ types.ID, c *Connection) error {
	s.connection = c
	return nil
}

func setupRHSSettingsPlugin(t *testing.T, api *plugintest.API, admin bool) (*Plugin, *memoryConnectionStore) {
	t.Helper()
	p := setupRHSHTTPPlugin(t, api)
	p.updateConfig(func(conf *config) {
		conf.Secret = "s3cr3t"
	})
	api.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: model.NewPointer("http://mm.example.com")}}).Maybe()
	api.On("HasPermissionTo", "connected_user", model.PermissionManageSystem).Return(admin)
	store := &memoryConnectionStore{connection: &Connection{
		User:     jira.User{Name: "ivan", DisplayName: "Иван Петров"},
		Settings: &ConnectionSettings{Notifications: true},
	}}
	p.userStore = store
	return p, store
}

func getRHSSettingsBody(t *testing.T, w *httptest.ResponseRecorder) RHSSettings {
	t.Helper()
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var body RHSSettings
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return body
}

func TestRHSSettingsForUser(t *testing.T) {
	api := &plugintest.API{}
	p, _ := setupRHSSettingsPlugin(t, api, false)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSSettings)+"?instance_id="+url.QueryEscape(mockInstance1URL), "connected_user")
	body := getRHSSettingsBody(t, w)
	assert.Equal(t, "Иван Петров", body.Account.DisplayName)
	assert.Equal(t, map[string]bool{"assignee": true, "mention": true, "reporter": true, "watching": true}, body.Notifications, "the old global switch applies to every role")
	assert.Nil(t, body.Admin, "the webhook secret is never sent to regular users")
	assert.NotEmpty(t, body.PluginVersion)
}

func TestRHSSettingsForAdmin(t *testing.T) {
	api := &plugintest.API{}
	p, _ := setupRHSSettingsPlugin(t, api, true)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSSettings)+"?instance_id="+url.QueryEscape(mockInstance1URL), "connected_user")
	body := getRHSSettingsBody(t, w)
	require.NotNil(t, body.Admin)
	assert.NotEmpty(t, body.Admin.Instances)
	assert.Contains(t, body.Admin.WebhookURL, "secret=s3cr3t")
	assert.Contains(t, body.Admin.WebhookURL, "/api/v2/webhook")
}

func TestRHSSettingsNotificationToggle(t *testing.T) {
	api := &plugintest.API{}
	p, store := setupRHSSettingsPlugin(t, api, false)

	w := doRHSHTTPPost(t, p, routeAPIRHSSettingsNotifications, rhsNotificationRequest{InstanceID: mockInstance1URL, Role: "watching", Enabled: false})
	body := getRHSSettingsBody(t, w)
	assert.False(t, body.Notifications["watching"])
	assert.True(t, body.Notifications["assignee"])
	assert.False(t, store.connection.Settings.RolesForDMNotification["watching"])

	w = doRHSHTTPPost(t, p, routeAPIRHSSettingsNotifications, rhsNotificationRequest{InstanceID: mockInstance1URL, Role: "everything", Enabled: true})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRHSSettingsForUnconnectedUser(t *testing.T) {
	api := &plugintest.API{}
	p, store := setupRHSSettingsPlugin(t, api, false)
	store.connection = &Connection{}

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSSettings)+"?instance_id="+url.QueryEscape(mockInstance1URL), "connected_user")
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Equal(t, rhsErrNotConnected, decodeRHSError(t, w).Error)

	w = doRHSHTTPPost(t, p, routeAPIRHSSettingsNotifications, rhsNotificationRequest{InstanceID: mockInstance1URL, Role: "watching", Enabled: true})
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Nil(t, store.connection.Settings, "nothing is stored for a user who never connected")
}
