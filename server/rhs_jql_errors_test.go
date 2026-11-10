// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

// jqlCheckClient rejects every query that is not in accepted.
type jqlCheckClient struct {
	testRHSCloudClient
	accepted map[string]bool
	seen     []string
}

func (c *jqlCheckClient) SearchJQL(params CloudSearchParams) (*CloudSearchResult, error) {
	c.seen = append(c.seen, params.JQL)
	if c.accepted[params.JQL] {
		return &CloudSearchResult{IsLast: true}, nil
	}
	return nil, RESTError{error: errors.New("Error in the JQL Query: expecting a field name at the end"), Status: http.StatusBadRequest}
}

func TestRHSUserJQLError(t *testing.T) {
	client := &jqlCheckClient{accepted: map[string]bool{"project = A": true}}
	assert.Equal(t, "Error in the JQL Query: expecting a field name at the end", rhsUserJQLError(client, " project = A AND "))
	assert.Equal(t, []string{"project = A AND"}, client.seen)

	// Accepted as typed: the error came from something else, keep Jira's.
	assert.Equal(t, "", rhsUserJQLError(client, "project = A"))
	assert.Equal(t, "", rhsUserJQLError(client, " "))
}
