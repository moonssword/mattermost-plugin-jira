// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

func testRHSIconInstance(jiraURL string) *serverInstance {
	return &serverInstance{InstanceCommon: &InstanceCommon{
		Plugin:     &Plugin{},
		Type:       ServerInstanceType,
		InstanceID: types.ID(jiraURL),
	}}
}

func TestParseRHSIconPath(t *testing.T) {
	for _, good := range []string{
		"/images/icons/priorities/medium.svg",
		"/secure/viewavatar?size=xsmall&avatarId=10303&avatarType=issuetype",
		"/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303",
	} {
		got, ok := parseRHSIconPath(good)
		assert.True(t, ok, good)
		assert.Equal(t, good, got)
	}
	for _, bad := range []string{
		"",
		"/rest/api/2/myself",
		"/secure/Dashboard.jspa",
		"/secure/viewavatar/../Dashboard.jspa",
		"/images/icons/../../rest/api/2/myself",
		"/images/icons/%2e%2e/%2e%2e/rest/api/2/myself",
		"//evil.example.com/images/icons/a.svg",
		"https://evil.example.com/images/icons/a.svg",
		"https://user@jira.example.com/images/icons/a.svg",
		"images/icons/a.svg",
		"/images/icons/a.svg#x",
	} {
		_, ok := parseRHSIconPath(bad)
		assert.False(t, ok, bad)
	}
}

func TestRHSIconURL(t *testing.T) {
	instance := testRHSIconInstance("https://jira.example.com/jira")

	got := rhsIconURL(instance, "https://jira.example.com/jira/secure/viewavatar?size=xsmall&avatarId=1")
	parsed, err := url.Parse(got)
	require.NoError(t, err)
	assert.Empty(t, parsed.Host, "the icon must load from the address the page is open on")
	assert.Equal(t, "/plugins/jira/api/v2/rhs/icon", parsed.Path)
	assert.Equal(t, "https://jira.example.com/jira", parsed.Query().Get(ParamInstanceID))
	assert.Equal(t, "/secure/viewavatar?size=xsmall&avatarId=1", parsed.Query().Get(queryRHSIconPath))

	other := "https://cdn.example.com/logo.svg"
	assert.Equal(t, other, rhsIconURL(instance, other), "not a Jira icon path")
	assert.Equal(t, "", rhsIconURL(instance, ""))

	cloud := "https://example.atlassian.net/images/icons/issuetypes/bug.svg"
	assert.Equal(t, cloud, rhsIconURL(testInstance1, cloud), "other instance types stay as they are")
}

type testRHSIconFetcher struct {
	contentType string
	err         error
	requested   string
}

func (f *testRHSIconFetcher) GetRHSIcon(iconPath string) (string, []byte, error) {
	f.requested = iconPath
	return f.contentType, []byte("<svg/>"), f.err
}

func TestServeRHSIcon(t *testing.T) {
	fetcher := &testRHSIconFetcher{contentType: "image/svg+xml"}
	w := httptest.NewRecorder()
	status, err := serveRHSIcon(w, fetcher, "/images/icons/a.svg")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, "/images/icons/a.svg", fetcher.requested)
	assert.Equal(t, "<svg/>", w.Body.String())
	assert.Equal(t, "image/svg+xml", w.Header().Get("Content-Type"))
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Contains(t, w.Header().Get("Content-Security-Policy"), "sandbox")
}

func TestServeRHSIconRejectsNonImages(t *testing.T) {
	w := httptest.NewRecorder()
	status, _ := serveRHSIcon(w, &testRHSIconFetcher{contentType: "text/html"}, "/images/icons/a.svg")
	assert.Equal(t, http.StatusNotFound, status)
	assert.NotContains(t, w.Body.String(), "<svg/>")
}

func TestServeRHSIconJiraError(t *testing.T) {
	w := httptest.NewRecorder()
	status, _ := serveRHSIcon(w, &testRHSIconFetcher{err: errors.New("jira is down")}, "/images/icons/a.svg")
	assert.Equal(t, http.StatusInternalServerError, status)
}

func TestRHSUserAvatarURL(t *testing.T) {
	instance := testRHSIconInstance("https://jira.example.com/jira")
	user := func(avatar string) *jira.User {
		return &jira.User{AvatarUrls: jira.AvatarUrls{Four8X48: avatar}}
	}

	uploaded := rhsUserAvatarURL(instance, user("https://jira.example.com/jira/secure/useravatar?ownerId=JIRAUSER1&avatarId=10600"))
	parsed, err := url.Parse(uploaded)
	require.NoError(t, err)
	assert.Empty(t, parsed.Host)
	assert.Equal(t, "/plugins/jira/api/v2/rhs/icon", parsed.Path)
	assert.Equal(t, "/secure/useravatar?ownerId=JIRAUSER1&avatarId=10600", parsed.Query().Get(queryRHSIconPath))

	for name, avatar := range map[string]string{
		"system avatar":         "https://jira.example.com/jira/secure/useravatar?avatarId=10122",
		"gravatar":              "https://www.gravatar.com/avatar/abc?d=mm&s=48",
		"owner on another path": "https://jira.example.com/jira/secure/viewavatar?ownerId=JIRAUSER1",
		"no avatar":             "",
	} {
		assert.Empty(t, rhsUserAvatarURL(instance, user(avatar)), name)
	}

	assert.Empty(t, rhsUserAvatarURL(testInstance1, user("https://x.atlassian.net/secure/useravatar?ownerId=1")), "not Server or Data Center")
	assert.Empty(t, rhsUserAvatarURL(instance, nil))
}
