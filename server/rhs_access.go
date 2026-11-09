// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"strings"
)

const (
	rhsAdminRoutePrefix = routeAPI + routeAPIRHSAdmin

	rhsErrUserNotAllowed = "rhs_not_allowed"
)

// parseRHSAllowedUsers reads the list of development mode users: logins
// separated by commas, spaces or lines, with or without the @.
func parseRHSAllowedUsers(raw string) map[string]struct{} {
	logins := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\n' || r == '\r' || r == '\t'
	})
	out := make(map[string]struct{}, len(logins))
	for _, login := range logins {
		login = strings.ToLower(strings.TrimPrefix(login, "@"))
		if login != "" {
			out[login] = struct{}{}
		}
	}
	return out
}

// isRHSAllowedForUser tells whether the plugin works for the user. In
// development mode only the listed users have it, for example while it is
// being tested on a production server; an empty list means nobody.
func (p *Plugin) isRHSAllowedForUser(userID string) bool {
	conf := p.getConfig()
	if !conf.RHSDevMode {
		return true
	}
	allowed := parseRHSAllowedUsers(conf.RHSAllowedUsers)
	if len(allowed) == 0 || userID == "" {
		return false
	}
	user, err := p.client.User.Get(userID)
	if err != nil || user == nil {
		p.client.Log.Warn("Failed to load a user to check access to the Jira plugin", "user_id", userID, "error", err)
		return false
	}
	_, ok := allowed[strings.ToLower(user.Username)]
	return ok
}

// rhsDevModeOpenRoutes stay open in development mode: the webapp learns from
// them that the plugin is off for the user, and the System Console pages check
// the admin permission themselves.
var rhsDevModeOpenRoutes = []string{routeAPI + routeAPISettingsInfo, routeAPI + routeAPIUserInfo}

func isRHSDevModeOpenRoute(path string) bool {
	if strings.HasPrefix(path, rhsAdminRoutePrefix) {
		return true
	}
	for _, route := range rhsDevModeOpenRoutes {
		if path == route {
			return true
		}
	}
	return false
}

// rhsAccessMiddleware closes the plugin's routes to users outside the
// development mode list. Requests without a Mattermost user, such as Jira
// webhooks, are not affected.
func (p *Plugin) rhsAccessMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get(HeaderMattermostUserID)
		if userID != "" && !isRHSDevModeOpenRoute(r.URL.Path) && !p.isRHSAllowedForUser(userID) {
			_, _ = respondJSONErr(w, http.StatusForbidden, rhsErrUserNotAllowed, "the Jira plugin is in development mode and not enabled for this user")
			return
		}
		next.ServeHTTP(w, r)
	})
}
