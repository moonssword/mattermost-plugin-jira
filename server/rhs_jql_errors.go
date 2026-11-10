// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
)

// rhsUserJQLError asks Jira about the JQL exactly as the user typed it. The
// panel adds its own order to a JQL without one, so Jira's complaint about
// a query cut short pointed at that "ORDER" the user never wrote. Empty when
// Jira accepts the query as typed.
func rhsUserJQLError(client rhsClient, query string) string {
	query = strings.TrimSpace(query)
	if query == "" {
		return ""
	}
	_, err := client.SearchJQL(CloudSearchParams{JQL: query, Fields: []string{"key"}, MaxResults: 1})
	restErr, badRequest := isJiraBadRequest(err)
	if !badRequest {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(restErr.Error(), " - "))
}
