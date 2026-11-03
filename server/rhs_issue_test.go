// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"

	jira "github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

type testRHSCardClient struct {
	testClient
	mu          sync.Mutex
	issue       *jira.Issue
	getErr      error
	getOptions  *jira.GetQueryOptions
	transition  string
	actionErr   error
	assignee    *jira.User
	unassigned  string
	comment     string
	userQuery   string
	users       []jira.User
	assignCalls int
}

func (c *testRHSCardClient) GetIssue(key string, options *jira.GetQueryOptions) (*jira.Issue, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.getOptions = options
	if c.getErr != nil {
		return nil, c.getErr
	}
	issue := *c.issue
	issue.Key = key
	return &issue, nil
}

func (c *testRHSCardClient) DoTransition(_, id string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.transition = id
	return c.actionErr
}

func (c *testRHSCardClient) UpdateAssignee(_ string, user *jira.User) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.assignCalls++
	c.assignee = user
	return c.actionErr
}

func (c *testRHSCardClient) rhsUnassign(_, field string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.unassigned = field
	return c.actionErr
}

func (c *testRHSCardClient) AddComment(_ string, comment *jira.Comment) (*jira.Comment, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.comment = comment.Body
	return comment, c.actionErr
}

func (c *testRHSCardClient) SearchUsersAssignableToIssue(_, query string, _ int) ([]jira.User, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userQuery = query
	return c.users, c.actionErr
}

type rhsMeUserStore struct {
	mockUserStore
}

func (rhsMeUserStore) LoadConnection(types.ID, types.ID) (*Connection, error) {
	return &Connection{User: jira.User{Name: "ivan", AccountID: "acc-ivan", DisplayName: "Иван Петров"}}, nil
}

func cardIssue() *jira.Issue {
	issue := tes41Issue()
	issue.Fields.Project.Name = "Test project"
	issue.Fields.Assignee = &jira.User{Name: "dk", AccountID: "acc-dk", DisplayName: "Дмитрий Козлов"}
	issue.Fields.Description = "Reports *larger* than 50 MB time out.\nh2. Шаги"
	issue.Fields.Comments = &jira.Comments{Comments: []*jira.Comment{
		{ID: "1", Author: jira.User{DisplayName: "Анна"}, Body: "Первый", Created: "2026-11-02T10:40:00.000+0300"},
		{ID: "2", Author: jira.User{DisplayName: "Дмитрий"}, Body: "Фикс в ветке", Created: "2026-11-03T10:40:00.000+0300"},
	}}
	issue.Transitions = []jira.Transition{
		{ID: "21", Name: "На ревью", To: jira.Status{Name: "Review", StatusCategory: jira.StatusCategory{Key: "indeterminate"}}},
		{ID: "31", Name: "Готово", To: jira.Status{Name: "Done", StatusCategory: jira.StatusCategory{Key: "done"}}},
	}
	return &issue
}

func installRHSCardInstance(t *testing.T, p *Plugin, client Client, typ InstanceType) rhsTestCloudInstance {
	t.Helper()
	inst := rhsTestCloudInstance{
		testInstance: testInstance{
			InstanceCommon: InstanceCommon{InstanceID: types.ID("http://jira.example.com"), Type: typ, Plugin: p},
		},
		client:      client,
		jiraBaseURL: "http://jira.example.com",
	}
	storeRHSInstance(t, p, inst)
	p.userStore = rhsMeUserStore{}
	return inst
}

func doRHSHTTPPost(t *testing.T, p *Plugin, route string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	require.NoError(t, err)
	request := httptest.NewRequest(http.MethodPost, makeAPIRoute(route), bytes.NewReader(raw))
	request.Header.Set(HeaderMattermostUserID, "connected_user")
	w := httptest.NewRecorder()
	p.ServeHTTP(&plugin.Context{}, w, request)
	return w
}

func decodeRHSCard(t *testing.T, w *httptest.ResponseRecorder) RHSIssueCard {
	t.Helper()
	require.Equal(t, http.StatusOK, w.Result().StatusCode, w.Body.String())
	var card RHSIssueCard
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &card))
	return card
}

func TestRHSGetIssueCard(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSIssue)+"?instance_id="+url.QueryEscape(string(inst.GetID()))+"&key=tes-41", "connected_user")
	card := decodeRHSCard(t, w)

	assert.Equal(t, "TES-41", card.Key)
	assert.Equal(t, "http://jira.example.com/browse/TES-41", card.BrowseURL)
	assert.Equal(t, "Test project", card.ProjectName)
	assert.Equal(t, "Дмитрий Козлов", card.Assignee.DisplayName)
	assert.Equal(t, "dk", card.Assignee.Name)
	assert.Equal(t, "Bea", card.Reporter.DisplayName)
	assert.Equal(t, []string{"rhs"}, card.Labels)
	assert.Contains(t, card.Description, "**larger**")
	assert.Contains(t, card.Description, "## Шаги")
	require.Len(t, card.Transitions, 2)
	assert.Equal(t, RHSTransition{ID: "31", Name: "Готово", To: RHSIssueStatus{Name: "Done", CategoryKey: "done"}}, card.Transitions[1])
	require.Len(t, card.Comments, 2)
	assert.Equal(t, "2026-11-03T07:40:00Z", card.Comments[1].Created)
	assert.Equal(t, 2, card.CommentsTotal)
	assert.Equal(t, "ivan", card.Me.Name)

	client.mu.Lock()
	defer client.mu.Unlock()
	assert.Equal(t, "transitions", client.getOptions.Expand)
	assert.Contains(t, client.getOptions.Fields, "comment")
}

func TestRHSGetIssueCardKeepsLastComments(t *testing.T) {
	issue := cardIssue()
	issue.Fields.Comments.Comments = nil
	for i := 0; i < rhsCardComments+5; i++ {
		issue.Fields.Comments.Comments = append(issue.Fields.Comments.Comments, &jira.Comment{ID: string(rune('a' + i))})
	}
	card := normalizeRHSIssueCard(testInstance1, issue, nil)
	assert.Len(t, card.Comments, rhsCardComments)
	assert.Equal(t, rhsCardComments+5, card.CommentsTotal)
	assert.Equal(t, string(rune('a'+5)), card.Comments[0].ID)
}

func TestRHSGetIssueCardErrors(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)
	base := makeAPIRoute(routeAPIRHSIssue) + "?instance_id=" + url.QueryEscape(string(inst.GetID()))

	w := doRHSHTTPGet(t, p, base+"&key="+url.QueryEscape("x = 1"), "connected_user")
	assert.Equal(t, http.StatusBadRequest, w.Result().StatusCode)

	client.getErr = RESTError{errors.New("nope"), http.StatusNotFound}
	w = doRHSHTTPGet(t, p, base+"&key=TES-1", "connected_user")
	assert.Equal(t, http.StatusNotFound, w.Result().StatusCode)
	assert.Equal(t, rhsErrNotFound, decodeRHSError(t, w).Error)

	client.getErr = RESTError{errors.New("nope"), http.StatusForbidden}
	w = doRHSHTTPGet(t, p, base+"&key=TES-1", "connected_user")
	assert.Equal(t, rhsErrForbidden, decodeRHSError(t, w).Error)
}

func TestRHSTransitionIssue(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)

	w := doRHSHTTPPost(t, p, routeAPIRHSIssueTransition, map[string]string{"instance_id": string(inst.GetID()), "key": "TES-41", "transition_id": "31"})
	card := decodeRHSCard(t, w)
	assert.Equal(t, "TES-41", card.Key)
	assert.Equal(t, "31", client.transition)

	client.actionErr = RESTError{errors.New(" - Resolution is required.\n"), http.StatusBadRequest}
	w = doRHSHTTPPost(t, p, routeAPIRHSIssueTransition, map[string]string{"instance_id": string(inst.GetID()), "key": "TES-41", "transition_id": "31"})
	require.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
	body := decodeRHSError(t, w)
	assert.Equal(t, rhsErrJiraRejected, body.Error)
	assert.Equal(t, "Resolution is required.", body.Message)

	w = doRHSHTTPPost(t, p, routeAPIRHSIssueTransition, map[string]string{"instance_id": string(inst.GetID()), "key": "TES-41"})
	assert.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
}

func TestRHSAssignIssueServerUsesNames(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)
	id := string(inst.GetID())

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueAssign, map[string]interface{}{"instance_id": id, "key": "TES-41", "assign_to_me": true}))
	assert.Equal(t, &jira.User{Name: "ivan"}, client.assignee)

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueAssign, map[string]interface{}{"instance_id": id, "key": "TES-41", "assignee": RHSUser{Name: "dk", AccountID: "ignored"}}))
	assert.Equal(t, &jira.User{Name: "dk"}, client.assignee)

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueAssign, map[string]interface{}{"instance_id": id, "key": "TES-41"}))
	assert.Equal(t, "name", client.unassigned)
	assert.Equal(t, 2, client.assignCalls)
}

func TestRHSAssignIssueCloudUsesAccountIDs(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, CloudOAuthInstanceType)
	id := string(inst.GetID())

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueAssign, map[string]interface{}{"instance_id": id, "key": "TES-41", "assign_to_me": true}))
	assert.Equal(t, &jira.User{AccountID: "acc-ivan"}, client.assignee)

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueAssign, map[string]interface{}{"instance_id": id, "key": "TES-41"}))
	assert.Equal(t, "accountId", client.unassigned)
}

func TestRHSCommentIssue(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)
	id := string(inst.GetID())

	decodeRHSCard(t, doRHSHTTPPost(t, p, routeAPIRHSIssueComment, map[string]string{"instance_id": id, "key": "TES-41", "body": "  Готово, проверьте  "}))
	assert.Equal(t, "Готово, проверьте", client.comment)

	w := doRHSHTTPPost(t, p, routeAPIRHSIssueComment, map[string]string{"instance_id": id, "key": "TES-41", "body": "   "})
	assert.Equal(t, http.StatusBadRequest, w.Result().StatusCode)
}

func TestRHSAssignableUsers(t *testing.T) {
	p := setupRHSHTTPPlugin(t, &plugintest.API{})
	client := &testRHSCardClient{issue: cardIssue(), users: []jira.User{{Name: "dk", DisplayName: "Дмитрий Козлов"}, {}}}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)

	w := doRHSHTTPGet(t, p, makeAPIRoute(routeAPIRHSAssignableUsers)+"?instance_id="+url.QueryEscape(string(inst.GetID()))+"&key=TES-41&q=%D0%B4%D0%BC", "connected_user")
	require.Equal(t, http.StatusOK, w.Result().StatusCode)
	var users []RHSUser
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &users))
	assert.Equal(t, []RHSUser{{Name: "dk", DisplayName: "Дмитрий Козлов"}}, users)
	assert.Equal(t, "дм", client.userQuery)
}

func TestRHSShareIssueChecksChannelPermission(t *testing.T) {
	api := &plugintest.API{}
	p := setupRHSHTTPPlugin(t, api)
	client := &testRHSCardClient{issue: cardIssue()}
	inst := installRHSCardInstance(t, p, client, ServerInstanceType)
	id := string(inst.GetID())

	api.On("HasPermissionToChannel", "connected_user", "town", model.PermissionCreatePost).Return(false).Once()
	w := doRHSHTTPPost(t, p, routeAPIRHSIssueShare, map[string]string{"instance_id": id, "key": "TES-41", "channel_id": "town"})
	assert.Equal(t, http.StatusForbidden, w.Result().StatusCode)

	api.On("HasPermissionToChannel", "connected_user", "town", model.PermissionCreatePost).Return(true).Once()
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.UserId == "connected_user" && post.ChannelId == "town" && post.GetProp("attachments") != nil
	})).Return(&model.Post{Id: "post1"}, nil).Once()
	w = doRHSHTTPPost(t, p, routeAPIRHSIssueShare, map[string]string{"instance_id": id, "key": "TES-41", "channel_id": "town"})
	require.Equal(t, http.StatusOK, w.Result().StatusCode, w.Body.String())
	api.AssertNumberOfCalls(t, "CreatePost", 1)
}
