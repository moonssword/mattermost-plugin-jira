// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/stretchr/testify/assert"
)

func TestParseRHSAllowedUsers(t *testing.T) {
	assert.Empty(t, parseRHSAllowedUsers(""))
	assert.Empty(t, parseRHSAllowedUsers(" , ;\n"))
	got := parseRHSAllowedUsers(" Ivan, @anna;petr\nOlga\tmax ")
	assert.Len(t, got, 5)
	for _, login := range []string{"ivan", "anna", "petr", "olga", "max"} {
		assert.Contains(t, got, login)
	}
}

func setupRHSAccessPlugin(t *testing.T, allowed string) *Plugin {
	t.Helper()
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	p.updateConfig(func(conf *config) {
		conf.RHSAllowedUsers = allowed
	})
	api.On("GetUser", "u1").Return(&model.User{Id: "u1", Username: "Ivan"}, nil)
	api.On("GetUser", "u2").Return(&model.User{Id: "u2", Username: "petr"}, nil)
	api.On("GetUser", "gone").Return(nil, model.NewAppError("GetUser", "not_found", nil, "", http.StatusNotFound))
	api.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	return p
}

func TestIsRHSAllowedForUser(t *testing.T) {
	everyone := setupRHSAccessPlugin(t, "")
	assert.True(t, everyone.isRHSAllowedForUser("u1"), "an empty list means everyone")

	listed := setupRHSAccessPlugin(t, "ivan, anna")
	assert.True(t, listed.isRHSAllowedForUser("u1"), "logins are not case sensitive")
	assert.False(t, listed.isRHSAllowedForUser("u2"))
	assert.False(t, listed.isRHSAllowedForUser("gone"), "an unknown user gets no access")
}

func TestRHSAccessMiddleware(t *testing.T) {
	p := setupRHSAccessPlugin(t, "ivan")
	reached := false
	handler := p.rhsAccessMiddleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		reached = true
	}))
	serve := func(path, userID string) *httptest.ResponseRecorder {
		reached = false
		r := httptest.NewRequest(http.MethodGet, path, nil)
		r.Header.Set(HeaderMattermostUserID, userID)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}

	w := serve("/api/v2/rhs/issues", "u2")
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), rhsErrUserNotAllowed)
	assert.False(t, reached)

	serve("/api/v2/rhs/issues", "u1")
	assert.True(t, reached, "a listed user reaches the panel routes")

	serve("/api/v2/rhs/admin", "u2")
	assert.True(t, reached, "the System Console checks the permission itself")

	serve("/api/v2/rhs/admin/setup", "u2")
	assert.True(t, reached)

	serve("/api/v2/settingsinfo", "u2")
	assert.True(t, reached, "other routes are not affected")
}

func TestLowercaseConfigKeys(t *testing.T) {
	got := lowercaseConfigKeys(map[string]interface{}{"RolesAllowed": "users", "secret": "s"})
	assert.Equal(t, map[string]interface{}{"rolesallowed": "users", "secret": "s"}, got)
}
