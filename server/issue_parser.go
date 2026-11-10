// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	jira "github.com/andygrunwald/go-jira"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

const maxIssueSummaryLength = 80

func mdKeySummaryLink(issue *jira.Issue, instance Instance) string {
	return fmt.Sprintf("[%s: %s (%s)](%s%s)", issue.Key, truncate(issue.Fields.Summary, maxIssueSummaryLength), issue.Fields.Status.Name, instance.GetJiraBaseURL(), "/browse/"+issue.Key)
}

// reporterSummary names the reporter. The avatar is left out: loaded straight
// from Jira by every reader's browser, it reached into the company network
// from the Mattermost page and Chrome asked for local network access.
func reporterSummary(reporter *jira.User) string {
	return reporter.Name
}

func getActions(p *Plugin, instanceID types.ID, client Client, issue *jira.Issue) ([]*model.PostAction, error) {
	var actions []*model.PostAction

	ctx := map[string]interface{}{
		"issue_key":   issue.ID,
		"instance_id": instanceID.String(),
	}

	if p != nil {
		if sig := p.generatePostActionSignature(issue.ID, instanceID.String()); sig != "" {
			ctx["action_signature"] = sig
		}
	}

	integration := &model.PostActionIntegration{
		URL:     fmt.Sprintf("/plugins/%s%s%s", manifest.Id, routeAPI, routeIssueTransition),
		Context: ctx,
	}

	var options []*model.PostActionOptions

	transitions, err := client.GetTransitions(issue.Key)
	if err != nil {
		return actions, err
	}

	// Remove current issue status from possible transitions
	for _, transition := range transitions {
		if transition.Name != issue.Fields.Status.Name {
			options = append(options, &model.PostActionOptions{
				Text:  transition.Name,
				Value: transition.To.Name,
			})
		}
	}

	actions = append(actions, &model.PostAction{
		Name:        p.localizeForChannel("Transition issue"),
		Type:        "select",
		Options:     options,
		Integration: integration,
	})

	actions = append(actions, &model.PostAction{
		Name: p.localizeForChannel("Share publicly"),
		Type: "button",
		Integration: &model.PostActionIntegration{
			URL:     fmt.Sprintf("/plugins/%s%s%s", manifest.Id, routeAPI, routeSharePublicly),
			Context: ctx,
		},
	})

	return actions, nil
}

func asSlackAttachment(instance Instance, client Client, issue *jira.Issue, showActions bool) ([]*model.SlackAttachment, error) {
	text := mdKeySummaryLink(issue, instance)
	desc := truncate(issue.Fields.Description, 3000)
	desc = preProcessText(desc)
	if desc != "" {
		text += "\n\n" + desc + "\n"
	}

	var fields []*model.SlackAttachmentField
	if issue.Fields.Assignee != nil {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Assignee",
			Value: issue.Fields.Assignee.DisplayName,
			Short: true,
		})
	}
	if issue.Fields.Priority != nil {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Priority",
			Value: issue.Fields.Priority.Name,
			Short: true,
		})
	}

	if issue.Fields.Reporter != nil {
		fields = append(fields, &model.SlackAttachmentField{
			Title: "Reporter",
			Value: reporterSummary(issue.Fields.Reporter),
			Short: true,
		})
	}

	fields = instance.Common().Plugin.localizeRHSFields(fields)

	var actions []*model.PostAction
	var err error
	if showActions {
		actions, err = getActions(instance.Common().Plugin, instance.GetID(), client, issue)
		if err != nil {
			return []*model.SlackAttachment{}, err
		}
	}

	return []*model.SlackAttachment{
		{
			// TODO is this supposed to be themed?
			Color:   "#95b7d0",
			Text:    text,
			Fields:  fields,
			Actions: actions,
		},
	}, nil
}
