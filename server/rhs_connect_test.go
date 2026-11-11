// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testDCInstanceURL = "https://jira.dc.example.com"

func setupRHSConnectPlugin(t *testing.T, connected bool) *Plugin {
	t.Helper()
	api := &plugintest.API{}
	p, store := setupRHSSettingsPlugin(t, api, false)
	if !connected {
		store.connection = &Connection{}
	}
	storeRHSInstance(t, p, &testInstance{InstanceCommon: InstanceCommon{InstanceID: testDCInstanceURL, Type: ServerInstanceType}})
	return p
}

func TestRHSConnectURL(t *testing.T) {
	route := makeAPIRoute(routeAPIRHSConnectURL) + "?instance_id=" + url.QueryEscape(testDCInstanceURL)

	t.Run("gives the Jira sign-in address to open in the browser", func(t *testing.T) {
		p := setupRHSConnectPlugin(t, false)
		w := doRHSHTTPGet(t, p, route, "connected_user")
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var body RHSConnectURL
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, testDCInstanceURL+"/UserConnectURL.some", body.URL)
	})

	t.Run("an account already connected is not connected again", func(t *testing.T) {
		p := setupRHSConnectPlugin(t, true)
		w := doRHSHTTPGet(t, p, route, "connected_user")
		assert.Equal(t, http.StatusConflict, w.Code)
		assert.Equal(t, rhsErrAlreadyConnected, decodeRHSError(t, w).Error)
	})

	t.Run("other instance types keep connecting in the app", func(t *testing.T) {
		p := setupRHSConnectPlugin(t, false)
		storeRHSInstance(t, p, testInstance1)
		w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSConnectURL)+"?instance_id="+url.QueryEscape(mockInstance1URL), "connected_user")
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestRHSCallbackWithoutSessionGoesToSignIn(t *testing.T) {
	p := setupRHSConnectPlugin(t, false)
	p.updateConfig(func(conf *config) {
		conf.mattermostSiteURL = "https://mm.example.com/chat"
	})
	callback := "/instance/aHR0cHM6Ly9qaXJh/oauth1/complete.html?oauth_token=t1&oauth_verifier=v1"
	r := httptest.NewRequest(http.MethodGet, callback, nil)
	w := httptest.NewRecorder()
	p.ServeHTTP(nil, w, r)

	require.Equal(t, http.StatusFound, w.Code)
	location, err := url.Parse(w.Header().Get("Location"))
	require.NoError(t, err)
	assert.Equal(t, "/chat/login", location.Path)
	back, err := url.Parse(location.Query().Get("redirect_to"))
	require.NoError(t, err)
	assert.Equal(t, "/plug/jira/connect-complete", back.Path)
	assert.Equal(t, "/plugins/jira"+callback, back.Query().Get("next"))
}
