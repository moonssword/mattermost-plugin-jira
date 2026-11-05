// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

const (
	routeAPIRHSIssueTransitionScreen = "/rhs/issue/transition/screen"

	queryRHSTransitionID = "transition_id"
)

// rhsTransitionRunner is implemented by the Jira clients. It is separate from
// Client because only the panel sends values along with a transition.
type rhsTransitionRunner interface {
	DoRHSTransition(issueKey, transitionID string, fields map[string]interface{}, comment string) error
}

// RHSTransitionScreen holds the fields of the screen Jira shows for a
// transition, in the shape of the create metadata. No fields means no screen.
type RHSTransitionScreen struct {
	Fields map[string]map[string]interface{} `json:"fields"`
}

type jiraTransitionsWithFields struct {
	Transitions []struct {
		ID     string                            `json:"id"`
		Fields map[string]map[string]interface{} `json:"fields"`
	} `json:"transitions"`
}

func (p *Plugin) registerRHSTransitionRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSIssueTransitionScreen, p.checkAuth(p.handleResponse(p.httpRHSTransitionScreen))).Methods(http.MethodGet)
}

func (p *Plugin) httpRHSTransitionScreen(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	transitionID := r.FormValue(queryRHSTransitionID)
	if transitionID == "" {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, "transition_id is required"))
	}
	screen, err := loadRHSTransitionScreen(ctx.instance, ctx.client, ctx.key, transitionID)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	return respondJSON(w, screen)
}

func loadRHSTransitionScreen(instance Instance, client Client, key, transitionID string) (*RHSTransitionScreen, error) {
	var result jiraTransitionsWithFields
	params := map[string]string{"expand": "transitions.fields", "transitionId": transitionID}
	if err := client.RESTGet("2/issue/"+key+"/transitions", params, &result); err != nil {
		return nil, err
	}
	screen := &RHSTransitionScreen{Fields: map[string]map[string]interface{}{}}
	for _, transition := range result.Transitions {
		if transition.ID != transitionID {
			continue
		}
		for id, field := range transition.Fields {
			rhsRewriteAllowedValueIcons(instance, field)
			screen.Fields[id] = field
		}
	}
	return screen, nil
}

// rhsRewriteAllowedValueIcons sends option icons through the plugin server,
// like the icons of the issues.
func rhsRewriteAllowedValueIcons(instance Instance, field map[string]interface{}) {
	values, ok := field["allowedValues"].([]interface{})
	if !ok {
		return
	}
	for _, value := range values {
		option, isMap := value.(map[string]interface{})
		if !isMap {
			continue
		}
		if icon, isString := option["iconUrl"].(string); isString {
			option["iconUrl"] = rhsIconURL(instance, icon)
		}
	}
}

// runRHSTransition sends the values of the screen form when there are any.
func runRHSTransition(client Client, key string, in *rhsIssueRequest) error {
	if len(in.Fields) == 0 && in.Comment == "" {
		return client.DoTransition(key, in.TransitionID)
	}
	if len(in.Comment) > rhsMaxCommentLength {
		return errors.Wrap(ErrInvalidRHSTab, "comment is too long")
	}
	runner, ok := client.(rhsTransitionRunner)
	if !ok {
		return ErrRHSUnsupportedInstance
	}
	return runner.DoRHSTransition(key, in.TransitionID, in.Fields, in.Comment)
}

// DoRHSTransition implements rhsTransitionRunner.
func (client JiraClient) DoRHSTransition(issueKey, transitionID string, fields map[string]interface{}, comment string) error {
	payload := map[string]interface{}{"transition": map[string]string{"id": transitionID}}
	if len(fields) > 0 {
		payload["fields"] = fields
	}
	if comment != "" {
		payload["update"] = map[string]interface{}{
			"comment": []interface{}{map[string]interface{}{"add": map[string]string{"body": comment}}},
		}
	}
	resp, err := client.Jira.Issue.DoTransitionWithPayload(issueKey, payload)
	if err != nil {
		return userFriendlyJiraError(resp, err)
	}
	return nil
}
