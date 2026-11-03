// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Settings screen of the RHS: replaces /jira me, /jira info, /jira settings
// notifications, /jira webhook and the instance list for admins.
const (
	routeAPIRHSSettings              = "/rhs/settings"
	routeAPIRHSSettingsNotifications = "/rhs/settings/notifications"
)

// rhsNotificationRoles are the personal DM notification kinds, in the order
// the panel shows them.
var rhsNotificationRoles = []string{assigneeRole, mentionRole, reporterRole, watchingRole}

func (p *Plugin) registerRHSSettingsRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSSettings, p.checkAuth(p.handleResponse(p.httpRHSSettings))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSSettingsNotifications, p.checkAuth(p.handleResponse(p.httpRHSSettingsNotifications))).Methods(http.MethodPost)
}

type RHSAdminInstance struct {
	InstanceID string `json:"instance_id"`
	Alias      string `json:"alias,omitempty"`
	Type       string `json:"type"`
}

type RHSAdminSettings struct {
	Instances  []RHSAdminInstance `json:"instances"`
	WebhookURL string             `json:"webhook_url"`
}

type RHSSettings struct {
	Account       RHSUser           `json:"account"`
	Notifications map[string]bool   `json:"notifications"`
	PluginVersion string            `json:"plugin_version"`
	Admin         *RHSAdminSettings `json:"admin,omitempty"`
}

func notificationSettings(connection *Connection) map[string]bool {
	out := make(map[string]bool, len(rhsNotificationRoles))
	for _, role := range rhsNotificationRoles {
		out[role] = connection.Settings != nil && connection.Settings.ShouldReceiveNotification(role)
	}
	return out
}

func (p *Plugin) rhsAdminSettings(instanceID types.ID) (*RHSAdminSettings, error) {
	instances, err := p.instanceStore.LoadInstances()
	if err != nil {
		return nil, err
	}
	out := &RHSAdminSettings{Instances: []RHSAdminInstance{}}
	for _, id := range instances.IDs() {
		ic := instances.Get(id)
		if ic == nil {
			continue
		}
		out.Instances = append(out.Instances, RHSAdminInstance{InstanceID: string(ic.InstanceID), Alias: ic.Alias, Type: string(ic.Type)})
	}
	out.WebhookURL = p.getSubscriptionsWebhookURL(instanceID)
	return out, nil
}

func (p *Plugin) getRHSSettings(instanceID types.ID, userID string) (*RHSSettings, error) {
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return nil, err
	}
	connection, err := p.userStore.LoadConnection(instanceID, types.ID(userID))
	if err != nil {
		return nil, err
	}
	settings := &RHSSettings{
		Account:       RHSUser{AccountID: connection.AccountID, Name: connection.Name, DisplayName: connection.DisplayName},
		Notifications: notificationSettings(connection),
		PluginVersion: manifest.Version,
	}
	// The webhook URL carries the plugin secret: system admins only.
	if p.client.User.HasPermissionTo(userID, model.PermissionManageSystem) {
		admin, adminErr := p.rhsAdminSettings(instanceID)
		if adminErr != nil {
			return nil, adminErr
		}
		settings.Admin = admin
	}
	return settings, nil
}

func (p *Plugin) httpRHSSettings(w http.ResponseWriter, r *http.Request) (int, error) {
	settings, err := p.getRHSSettings(types.ID(r.FormValue(ParamInstanceID)), r.Header.Get(HeaderMattermostUserID))
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, settings)
}

type rhsNotificationRequest struct {
	InstanceID string `json:"instance_id"`
	Role       string `json:"role"`
	Enabled    bool   `json:"enabled"`
}

func (p *Plugin) httpRHSSettingsNotifications(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := r.Header.Get(HeaderMattermostUserID)
	var in rhsNotificationRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&in); err != nil {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, "invalid request body"))
	}
	instanceID := types.ID(in.InstanceID)
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return respondRHSErr(w, err)
	}
	connection, err := p.userStore.LoadConnection(instanceID, types.ID(userID))
	if err != nil {
		return respondRHSErr(w, err)
	}
	if connection.Settings == nil {
		connection.Settings = &ConnectionSettings{}
	}
	value := settingOff
	if in.Enabled {
		value = settingOn
	}
	if msg, ok := connection.updateRolesForDMNotification(in.Role, value); !ok {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, msg))
	}
	if err = p.userStore.StoreConnection(instanceID, types.ID(userID), connection); err != nil {
		return respondRHSErr(w, err)
	}
	settings, err := p.getRHSSettings(instanceID, userID)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, settings)
}
