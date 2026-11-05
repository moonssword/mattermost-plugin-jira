// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/kvstore"
	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Settings screen of the RHS: replaces /jira me, /jira info and /jira settings
// notifications. The admin routes serve the block in the System Console.
const (
	routeAPIRHSSettings              = "/rhs/settings"
	routeAPIRHSSettingsNotifications = "/rhs/settings/notifications"
	routeAPIRHSAdmin                 = "/rhs/admin"
	routeAPIRHSAdminSetup            = "/rhs/admin/setup"
)

// rhsNotificationRoles are the personal DM notification kinds, in the order
// the panel shows them.
var rhsNotificationRoles = []string{assigneeRole, mentionRole, reporterRole, watchingRole}

func (p *Plugin) registerRHSSettingsRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSSettings, p.checkAuth(p.handleResponse(p.httpRHSSettings))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSSettingsNotifications, p.checkAuth(p.handleResponse(p.httpRHSSettingsNotifications))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSAdmin, p.checkAuth(p.handleResponse(p.httpRHSAdmin))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSAdminSetup, p.checkAuth(p.handleResponse(p.httpRHSAdminSetup))).Methods(http.MethodPost)
}

type RHSAdminInstance struct {
	InstanceID string `json:"instance_id"`
	Alias      string `json:"alias,omitempty"`
	Type       string `json:"type"`
	// The webhook URL carries the plugin secret: system admins only.
	WebhookURL string `json:"webhook_url"`
}

type RHSAdminSettings struct {
	Instances     []RHSAdminInstance `json:"instances"`
	PluginVersion string             `json:"plugin_version"`
}

type RHSSettings struct {
	Account       RHSUser         `json:"account"`
	Notifications map[string]bool `json:"notifications"`
	PluginVersion string          `json:"plugin_version"`
}

// loadRHSConnection loads the user's Jira connection and treats the empty
// record the store returns for users who never connected as "not connected",
// so nothing is shown for it and nothing is stored on top of it.
func (p *Plugin) loadRHSConnection(instanceID types.ID, userID string) (*Connection, error) {
	connection, err := p.userStore.LoadConnection(instanceID, types.ID(userID))
	if err != nil {
		return nil, err
	}
	if connection == nil || (connection.AccountID == "" && connection.Name == "" && connection.Oauth1AccessToken == "" && connection.OAuth2Token == nil) {
		return nil, kvstore.ErrNotFound
	}
	return connection, nil
}

func notificationSettings(connection *Connection) map[string]bool {
	out := make(map[string]bool, len(rhsNotificationRoles))
	for _, role := range rhsNotificationRoles {
		out[role] = connection.Settings != nil && connection.Settings.ShouldReceiveNotification(role)
	}
	return out
}

func (p *Plugin) rhsAdminSettings() (*RHSAdminSettings, error) {
	instances, err := p.instanceStore.LoadInstances()
	if err != nil {
		return nil, err
	}
	out := &RHSAdminSettings{Instances: []RHSAdminInstance{}, PluginVersion: manifest.Version}
	for _, id := range instances.IDs() {
		ic := instances.Get(id)
		if ic == nil {
			continue
		}
		out.Instances = append(out.Instances, RHSAdminInstance{
			InstanceID: string(ic.InstanceID),
			Alias:      ic.Alias,
			Type:       string(ic.Type),
			WebhookURL: p.getSubscriptionsWebhookURL(id),
		})
	}
	return out, nil
}

func (p *Plugin) isRHSSystemAdmin(r *http.Request) bool {
	return p.client.User.HasPermissionTo(r.Header.Get(HeaderMattermostUserID), model.PermissionManageSystem)
}

func (p *Plugin) httpRHSAdmin(w http.ResponseWriter, r *http.Request) (int, error) {
	if !p.isRHSSystemAdmin(r) {
		return respondJSONErr(w, http.StatusForbidden, rhsErrForbidden, "system administrators only")
	}
	settings, err := p.rhsAdminSettings()
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, settings)
}

// httpRHSAdminSetup starts the setup wizard in the DM with the bot, without
// the channel /jira setup needs: the System Console has none.
func (p *Plugin) httpRHSAdminSetup(w http.ResponseWriter, r *http.Request) (int, error) {
	if !p.isRHSSystemAdmin(r) {
		return respondJSONErr(w, http.StatusForbidden, rhsErrForbidden, "system administrators only")
	}
	if err := p.setupFlow.ForUser(r.Header.Get(HeaderMattermostUserID)).Start(nil); err != nil {
		return respondRHSErr(w, errors.Wrap(err, "failed to start the setup wizard"))
	}
	return respondJSON(w, map[string]string{"status": "started"})
}

// rhsOwnAvatarURL reads the user's picture from Jira: the stored connection has
// the one from the moment of connecting. Without an answer the panel shows initials.
func (p *Plugin) rhsOwnAvatarURL(instance Instance, connection *Connection) string {
	if instance.Common().Type != ServerInstanceType {
		return ""
	}
	client, err := instance.GetClient(connection)
	if err != nil || client == nil {
		return rhsUserAvatarURL(instance, &connection.User)
	}
	self, err := client.GetSelf()
	if err != nil || self == nil {
		return rhsUserAvatarURL(instance, &connection.User)
	}
	return rhsUserAvatarURL(instance, self)
}

func (p *Plugin) getRHSSettings(instanceID types.ID, userID string) (*RHSSettings, error) {
	instance, err := p.loadRHSInstance(instanceID)
	if err != nil {
		return nil, err
	}
	connection, err := p.loadRHSConnection(instanceID, userID)
	if err != nil {
		return nil, err
	}
	settings := &RHSSettings{
		Account:       RHSUser{AccountID: connection.AccountID, Name: connection.Name, DisplayName: connection.DisplayName, AvatarURL: p.rhsOwnAvatarURL(instance, connection)},
		Notifications: notificationSettings(connection),
		PluginVersion: manifest.Version,
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
	connection, err := p.loadRHSConnection(instanceID, userID)
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
