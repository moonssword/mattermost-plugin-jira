// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Connecting from the Mattermost desktop app. The app signs in to Jira in a
// window of its own, without the browser's cookies, and a Jira behind single
// sign-on (ADFS with Windows sign-in) can leave that window blank. The app
// therefore asks for the Jira sign-in address and opens it in the computer's
// browser. Back from Jira, the browser must be signed in to Mattermost as the
// same user: the temporary credentials are kept per Mattermost user and the
// callback checks them, so another account cannot finish someone's connection.
const (
	routeAPIRHSConnectURL = "/rhs/connect-url"

	// rhsConnectCompletePage is the webapp page (/plug/<plugin id>/...) that
	// sends the browser back to the Jira callback after signing in.
	rhsConnectCompletePage = "/connect-complete"
	queryRHSConnectNext    = "next"

	rhsErrAlreadyConnected = "already_connected"
)

// RHSConnectURL is the Jira sign-in address for the computer's browser.
type RHSConnectURL struct {
	URL string `json:"url"`
}

func (p *Plugin) registerRHSConnectRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSConnectURL, p.checkAuth(p.handleResponse(p.httpRHSConnectURL))).Methods(http.MethodGet)
}

func (p *Plugin) httpRHSConnectURL(w http.ResponseWriter, r *http.Request) (int, error) {
	mattermostUserID := r.Header.Get(HeaderMattermostUserID)
	instance, err := p.loadRHSInstance(types.ID(r.FormValue(ParamInstanceID)))
	if err != nil {
		return respondRHSErr(w, err)
	}
	if connection, loadErr := p.userStore.LoadConnection(instance.GetID(), types.ID(mattermostUserID)); loadErr == nil && connection.JiraAccountID() != "" {
		return respondJSONErr(w, http.StatusConflict, rhsErrAlreadyConnected, "the Jira account is already connected")
	}

	// Cloud keeps a state cookie that must come back with the callback, which
	// another browser does not have: those instances connect as before.
	if instance.Common().Type != ServerInstanceType {
		return respondJSONErr(w, http.StatusBadRequest, rhsErrUnsupported, "connecting in the browser is for Jira Server/Data Center")
	}
	connectURL, cookie, err := instance.GetUserConnectURL(mattermostUserID)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	if cookie != nil {
		return respondJSONErr(w, http.StatusBadRequest, rhsErrUnsupported, "this instance needs a cookie to connect")
	}
	return respondJSON(w, RHSConnectURL{URL: connectURL})
}

// rhsSignInURL sends a browser without a Mattermost session to the sign-in
// page, which then returns it to the same address through the webapp.
func (p *Plugin) rhsSignInURL(r *http.Request) string {
	next := p.GetPluginURLPath() + r.URL.Path
	if r.URL.RawQuery != "" {
		next += "?" + r.URL.RawQuery
	}
	sitePath := ""
	if site, err := url.Parse(p.GetSiteURL()); err == nil {
		sitePath = strings.TrimRight(site.Path, "/")
	}
	back := "/plug/" + manifest.Id + rhsConnectCompletePage + "?" + url.Values{queryRHSConnectNext: {next}}.Encode()
	return sitePath + "/login?" + url.Values{"redirect_to": {back}}.Encode()
}

// checkAuthOrSignIn is checkAuth for pages the browser opens itself: without
// a session it goes to the Mattermost sign-in instead of "Not authorized".
func (p *Plugin) checkAuthOrSignIn(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(HeaderMattermostUserID) == "" {
			if r.Method != http.MethodGet {
				http.Error(w, "Not authorized", http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, p.rhsSignInURL(r), http.StatusFound)
			return
		}
		handler(w, r)
	}
}
