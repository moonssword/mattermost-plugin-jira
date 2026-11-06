// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	jira "github.com/andygrunwald/go-jira"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Issue card endpoints of the RHS. Every request acts as the connected user.
const (
	routeAPIRHSIssue           = "/rhs/issue"
	routeAPIRHSIssueTransition = "/rhs/issue/transition"
	routeAPIRHSIssueAssign     = "/rhs/issue/assign"
	routeAPIRHSIssueComment    = "/rhs/issue/comment"
	routeAPIRHSIssueShare      = "/rhs/issue/share"
	routeAPIRHSAssignableUsers = "/rhs/users/assignable"

	queryRHSIssueKey = "key"
	queryRHSUserText = "q"

	rhsCardComments        = 20
	rhsAssignableUsersMax  = 20
	rhsMaxCommentLength    = 32000
	rhsIssueCardFieldNames = "summary,status,issuetype,updated,created,project,duedate,priority,assignee,reporter,labels,description,comment,attachment"
)

var (
	ErrRHSIssueNotFound = errors.New("jira issue not found")
	ErrRHSForbidden     = errors.New("not allowed in jira")

	// ErrRHSJiraRejected wraps a Jira 400 for an action (for example a
	// transition with a required screen field); the message is shown as is.
	ErrRHSJiraRejected = errors.New("jira rejected the request")

	rhsStrictIssueKeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*-[0-9]+$`)
)

func (p *Plugin) registerRHSIssueRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSIssue, p.checkAuth(p.handleResponse(p.httpRHSGetIssue))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSIssueTransition, p.checkAuth(p.handleResponse(p.httpRHSTransitionIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSIssueAssign, p.checkAuth(p.handleResponse(p.httpRHSAssignIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSIssueComment, p.checkAuth(p.handleResponse(p.httpRHSCommentIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSIssueShare, p.checkAuth(p.handleResponse(p.httpRHSShareIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSAssignableUsers, p.checkAuth(p.handleResponse(p.httpRHSAssignableUsers))).Methods(http.MethodGet)
	p.registerRHSTransitionRoutes(apiRouter)
	p.registerRHSAttachmentRoutes(apiRouter)
}

// RHSUser is a Jira user as the panel shows it.
type RHSUser struct {
	AccountID   string `json:"accountId,omitempty"`
	Name        string `json:"name,omitempty"`
	DisplayName string `json:"displayName"`

	// AvatarURL is an uploaded picture served by the plugin; empty means initials.
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type RHSTransition struct {
	ID string `json:"id"`

	// Name of the transition (workflow button), e.g. "Start progress".
	Name string         `json:"name"`
	To   RHSIssueStatus `json:"to"`
}

type RHSComment struct {
	ID      string  `json:"id"`
	Author  RHSUser `json:"author"`
	Body    string  `json:"body"`
	Created string  `json:"created"`
}

type RHSIssueCard struct {
	RHSIssue
	ProjectName   string          `json:"projectName,omitempty"`
	Assignee      *RHSUser        `json:"assignee"`
	Reporter      *RHSUser        `json:"reporter"`
	Labels        []string        `json:"labels"`
	Description   string          `json:"description"`
	Transitions   []RHSTransition `json:"transitions"`
	Comments      []RHSComment    `json:"comments"`
	CommentsTotal int             `json:"commentsTotal"`
	Attachments   []RHSAttachment `json:"attachments"`

	// Me is the connected Jira user, so the card can offer "Назначить на меня".
	Me RHSUser `json:"me"`
}

func toRHSUser(instance Instance, u *jira.User) *RHSUser {
	if u == nil || (u.AccountID == "" && u.Name == "" && u.DisplayName == "") {
		return nil
	}
	return &RHSUser{AccountID: u.AccountID, Name: u.Name, DisplayName: u.DisplayName, AvatarURL: rhsUserAvatarURL(instance, u)}
}

// jiraCommentTime converts Jira's "2006-01-02T15:04:05.000-0700" to RFC 3339.
func jiraCommentTime(s string) string {
	t, err := time.Parse("2006-01-02T15:04:05.000-0700", s)
	if err != nil {
		return s
	}
	return t.UTC().Format(time.RFC3339)
}

func normalizeRHSIssueCard(instance Instance, issue *jira.Issue, me *jira.User) *RHSIssueCard {
	card := &RHSIssueCard{
		RHSIssue:    normalizeRHSIssue(instance, *issue),
		Labels:      []string{},
		Transitions: []RHSTransition{},
		Comments:    []RHSComment{},
		Attachments: []RHSAttachment{},
	}
	if me != nil {
		card.Me = RHSUser{AccountID: me.AccountID, Name: me.Name, DisplayName: me.DisplayName, AvatarURL: rhsUserAvatarURL(instance, me)}
	}

	for _, t := range issue.Transitions {
		card.Transitions = append(card.Transitions, RHSTransition{
			ID:   t.ID,
			Name: t.Name,
			To:   RHSIssueStatus{ID: t.To.ID, Name: t.To.Name, CategoryKey: t.To.StatusCategory.Key},
		})
	}

	f := issue.Fields
	if f == nil {
		return card
	}
	var files map[string]rhsMarkupFile
	card.Attachments, files = rhsAttachments(instance, issue.Key, f.Attachments)
	card.ProjectName = f.Project.Name
	card.Assignee = toRHSUser(instance, f.Assignee)
	card.Reporter = toRHSUser(instance, f.Reporter)
	if f.Labels != nil {
		card.Labels = f.Labels
	}
	card.Description = jiraTextToMarkdown(f.Description, files)

	if f.Comments != nil {
		all := f.Comments.Comments
		card.CommentsTotal = len(all)
		if len(all) > rhsCardComments {
			all = all[len(all)-rhsCardComments:]
		}
		for _, c := range all {
			if c == nil {
				continue
			}
			card.Comments = append(card.Comments, RHSComment{
				ID:      c.ID,
				Author:  RHSUser{AccountID: c.Author.AccountID, Name: c.Author.Name, DisplayName: c.Author.DisplayName, AvatarURL: rhsUserAvatarURL(instance, &c.Author)},
				Body:    jiraTextToMarkdown(c.Body, files),
				Created: jiraCommentTime(c.Created),
			})
		}
	}
	return card
}

// rhsJiraError maps Jira failures of card actions to errors the RHS reports
// with a dedicated code.
func rhsJiraError(err error) error {
	if err == nil {
		return nil
	}
	switch StatusCode(err) {
	case http.StatusNotFound:
		return errors.Wrap(ErrRHSIssueNotFound, err.Error())
	case http.StatusForbidden, http.StatusUnauthorized:
		return errors.Wrap(ErrRHSForbidden, err.Error())
	case http.StatusBadRequest:
		return fmt.Errorf("%w: %s", ErrRHSJiraRejected, strings.TrimSpace(strings.TrimPrefix(err.Error(), " - ")))
	default:
		return err
	}
}

type rhsIssueContext struct {
	instance   Instance
	client     Client
	connection *Connection
	key        string
}

func (p *Plugin) rhsIssueContext(instanceID, mattermostUserID types.ID, key string) (*rhsIssueContext, error) {
	key = strings.ToUpper(strings.TrimSpace(key))
	if !rhsStrictIssueKeyPattern.MatchString(key) {
		return nil, errors.Wrap(ErrInvalidRHSTab, "invalid issue key")
	}
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return nil, err
	}
	client, instance, connection, err := p.getRHSClient(instanceID, mattermostUserID)
	if err != nil {
		return nil, err
	}
	return &rhsIssueContext{instance: instance, client: client, connection: connection, key: key}, nil
}

func (p *Plugin) loadRHSIssueCard(ctx *rhsIssueContext) (*RHSIssueCard, error) {
	issue, err := ctx.client.GetIssue(ctx.key, &jira.GetQueryOptions{
		Fields: rhsIssueCardFieldNames,
		Expand: "transitions",
	})
	if err != nil {
		return nil, rhsJiraError(err)
	}
	return normalizeRHSIssueCard(ctx.instance, issue, &ctx.connection.User), nil
}

func (p *Plugin) httpRHSGetIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	card, err := p.loadRHSIssueCard(ctx)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, card)
}

type rhsIssueRequest struct {
	InstanceID   string   `json:"instance_id"`
	Key          string   `json:"key"`
	TransitionID string   `json:"transition_id,omitempty"`
	Assignee     *RHSUser `json:"assignee,omitempty"`
	AssignToMe   bool     `json:"assign_to_me,omitempty"`
	Body         string   `json:"body,omitempty"`
	ChannelID    string   `json:"channel_id,omitempty"`
	// Values of the transition screen, passed to Jira as they are.
	Fields  map[string]interface{} `json:"fields,omitempty"`
	Comment string                 `json:"comment,omitempty"`
}

func (p *Plugin) decodeRHSIssueRequest(r *http.Request) (*rhsIssueContext, *rhsIssueRequest, error) {
	var in rhsIssueRequest
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20)).Decode(&in); err != nil {
		return nil, nil, errors.Wrap(ErrInvalidRHSTab, "invalid request body")
	}
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(in.InstanceID), userID, in.Key)
	if err != nil {
		return nil, nil, err
	}
	return ctx, &in, nil
}

// respondRHSCard reloads the card after an action so the panel shows what
// Jira stored, including the transitions available from the new status.
func (p *Plugin) respondRHSCard(w http.ResponseWriter, ctx *rhsIssueContext) (int, error) {
	card, err := p.loadRHSIssueCard(ctx)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, card)
}

func (p *Plugin) httpRHSTransitionIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	ctx, in, err := p.decodeRHSIssueRequest(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	if in.TransitionID == "" {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, "transition_id is required"))
	}
	if err = runRHSTransition(ctx.client, ctx.key, in); err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	return p.respondRHSCard(w, ctx)
}

// rhsAssignee picks the Jira identity field: Cloud uses accountId, Server/DC
// uses the user name. An empty result means "unassign".
func rhsAssignee(instance Instance, in *rhsIssueRequest, me jira.User) *jira.User {
	var u RHSUser
	switch {
	case in.AssignToMe:
		u = RHSUser{AccountID: me.AccountID, Name: me.Name}
	case in.Assignee != nil:
		u = *in.Assignee
	default:
		return &jira.User{}
	}
	if instance.Common().Type == ServerInstanceType {
		return &jira.User{Name: u.Name}
	}
	return &jira.User{AccountID: u.AccountID}
}

func (p *Plugin) httpRHSAssignIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	ctx, in, err := p.decodeRHSIssueRequest(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	user := rhsAssignee(ctx.instance, in, ctx.connection.User)
	if user.AccountID == "" && user.Name == "" {
		err = rhsUnassign(ctx.client, ctx.instance, ctx.key)
	} else {
		err = ctx.client.UpdateAssignee(ctx.key, user)
	}
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	return p.respondRHSCard(w, ctx)
}

// rhsUnassigner is implemented by both Jira clients through JiraClient.
type rhsUnassigner interface {
	rhsUnassign(issueKey, field string) error
}

func rhsUnassign(client Client, instance Instance, issueKey string) error {
	field := "accountId"
	if instance.Common().Type == ServerInstanceType {
		field = "name"
	}
	if u, ok := client.(rhsUnassigner); ok {
		return u.rhsUnassign(issueKey, field)
	}
	return client.UpdateAssignee(issueKey, &jira.User{})
}

// rhsUnassign sends an explicit null: Jira treats a missing field as "keep"
// on some versions, and -1 would mean "automatic assignee".
func (client JiraClient) rhsUnassign(issueKey, field string) error {
	req, err := client.Jira.NewRequest(http.MethodPut, "rest/api/2/issue/"+issueKey+"/assignee", map[string]interface{}{field: nil})
	if err != nil {
		return err
	}
	resp, err := client.Jira.Do(req, nil)
	if err != nil {
		return userFriendlyJiraError(resp, err)
	}
	closeJiraResp(resp)
	return nil
}

func (p *Plugin) httpRHSCommentIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	ctx, in, err := p.decodeRHSIssueRequest(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	body := strings.TrimSpace(in.Body)
	if body == "" || len(body) > rhsMaxCommentLength {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, "comment must be 1 to 32000 characters"))
	}
	if _, err = ctx.client.AddComment(ctx.key, &jira.Comment{Body: body}); err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	return p.respondRHSCard(w, ctx)
}

// httpRHSShareIssue posts the issue card to a channel as the user, the same
// post as "Share publicly" of /jira view.
func (p *Plugin) httpRHSShareIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	ctx, in, err := p.decodeRHSIssueRequest(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	userID := r.Header.Get(HeaderMattermostUserID)
	if in.ChannelID == "" || !p.client.User.HasPermissionToChannel(userID, in.ChannelID, model.PermissionCreatePost) {
		return respondJSONErr(w, http.StatusForbidden, rhsErrNotAuthorized, "cannot post to this channel")
	}

	attachment, err := p.getIssueAsSlackAttachment(ctx.instance, ctx.connection, ctx.key, false)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	post := &model.Post{UserId: userID, ChannelId: in.ChannelID}
	post.AddProp("attachments", attachment)
	if err = p.client.Post.CreatePost(post); err != nil {
		return respondRHSErr(w, errors.Wrap(err, "failed to create post"))
	}
	return respondJSON(w, map[string]string{"post_id": post.Id})
}

func (p *Plugin) httpRHSAssignableUsers(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	users, err := ctx.client.SearchUsersAssignableToIssue(ctx.key, strings.TrimSpace(r.FormValue(queryRHSUserText)), rhsAssignableUsersMax)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	out := make([]RHSUser, 0, len(users))
	for i := range users {
		if u := toRHSUser(ctx.instance, &users[i]); u != nil {
			out = append(out, *u)
		}
	}
	return respondJSON(w, out)
}
