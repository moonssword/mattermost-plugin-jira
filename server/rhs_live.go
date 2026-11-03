// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// websocketEventRHSIssueChanged tells an open Jira RHS that an issue it may
// show has changed. The payload carries only the instance and issue key: the
// panel reloads through the plugin API with the user's own Jira permissions.
const websocketEventRHSIssueChanged = "rhs_issue_changed"

// rhsIssueAudience returns the Jira users involved in a webhook event: the
// people upstream already notifies (assignee, mentions, reporter, watchers),
// the current assignee and reporter, and a previous assignee from the
// changelog, so an issue leaving someone's list also updates their panel.
func rhsIssueAudience(wh *webhook) []string {
	var keys []string
	add := func(accountID, name string) {
		switch {
		case accountID != "":
			keys = append(keys, accountID)
		case name != "":
			keys = append(keys, name)
		}
	}

	for _, n := range wh.notifications {
		add(n.jiraAccountID, n.jiraUsername)
	}
	if f := wh.Issue.Fields; f != nil {
		if f.Assignee != nil {
			add(f.Assignee.AccountID, f.Assignee.Name)
		}
		if f.Reporter != nil {
			add(f.Reporter.AccountID, f.Reporter.Name)
		}
	}
	for _, item := range wh.ChangeLog.Items {
		if item.Field == "assignee" {
			// Both ids (Cloud accountId) and user names (Server/DC) land in
			// From/To depending on the Jira flavor.
			add(item.From, "")
			add(item.To, "")
		}
	}
	return keys
}

// publishRHSIssueChanged sends the event to the connected Mattermost users
// behind the audience. Users without a connection are skipped silently.
func (p *Plugin) publishRHSIssueChanged(wh *webhook, instanceID types.ID) {
	if wh == nil || wh.JiraWebhook == nil || wh.Issue.Key == "" {
		return
	}
	payload := map[string]interface{}{
		"instance_id": instanceID.String(),
		"issue_key":   wh.Issue.Key,
		"event":       wh.WebhookEvent,
	}

	sent := map[types.ID]bool{}
	for _, key := range rhsIssueAudience(wh) {
		mattermostUserID, err := p.userStore.LoadMattermostUserID(instanceID, key)
		if err != nil || mattermostUserID == "" || sent[mattermostUserID] {
			continue
		}
		sent[mattermostUserID] = true
		p.client.Frontend.PublishWebSocketEvent(websocketEventRHSIssueChanged, payload, &model.WebsocketBroadcast{UserId: mattermostUserID.String()})
	}
}
