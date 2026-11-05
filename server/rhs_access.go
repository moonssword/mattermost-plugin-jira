// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"strings"
)

const (
	rhsRoutePrefix      = routeAPI + "/rhs/"
	rhsAdminRoutePrefix = routeAPI + routeAPIRHSAdmin

	rhsErrUserNotAllowed = "rhs_not_allowed"
)

// parseRHSAllowedUsers reads the RHSAllowedUsers setting: logins separated by
// commas or spaces, with or without the @. Empty means the panel is for everyone.
func parseRHSAllowedUsers(raw string) map[string]struct{} {
	logins := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\n' || r == '\t'
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

// isRHSAllowedForUser limits the panel to the listed users, for example while
// it is being tested on a production server.
func (p *Plugin) isRHSAllowedForUser(userID string) bool {
	allowed := parseRHSAllowedUsers(p.getConfig().RHSAllowedUsers)
	if len(allowed) == 0 {
		return true
	}
	user, err := p.client.User.Get(userID)
	if err != nil || user == nil {
		p.client.Log.Warn("Failed to load a user to check access to the Jira panel", "user_id", userID, "error", err)
		return false
	}
	_, ok := allowed[strings.ToLower(user.Username)]
	return ok
}

// rhsAccessMiddleware closes the panel routes for users outside the list. The
// admin routes serve the System Console and check the permission themselves.
func (p *Plugin) rhsAccessMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasPrefix(path, rhsRoutePrefix) && !strings.HasPrefix(path, rhsAdminRoutePrefix) &&
			!p.isRHSAllowedForUser(r.Header.Get(HeaderMattermostUserID)) {
			_, _ = respondJSONErr(w, http.StatusForbidden, rhsErrUserNotAllowed, "the Jira panel is not enabled for this user")
			return
		}
		next.ServeHTTP(w, r)
	})
}
