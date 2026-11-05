// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testTransitionClient struct {
	testClient
	body        string
	getParams   map[string]string
	plainID     string
	runKey      string
	runID       string
	runFields   map[string]interface{}
	runComment  string
	getEndpoint string
}

func (c *testTransitionClient) RESTGet(endpoint string, params map[string]string, dest interface{}) error {
	c.getEndpoint = endpoint
	c.getParams = params
	return json.Unmarshal([]byte(c.body), dest)
}

func (c *testTransitionClient) DoTransition(_, transitionID string) error {
	c.plainID = transitionID
	return nil
}

func (c *testTransitionClient) DoRHSTransition(issueKey, transitionID string, fields map[string]interface{}, comment string) error {
	c.runKey, c.runID, c.runFields, c.runComment = issueKey, transitionID, fields, comment
	return nil
}

func TestLoadRHSTransitionScreen(t *testing.T) {
	client := &testTransitionClient{body: `{"transitions":[
		{"id":"31","fields":{}},
		{"id":"41","fields":{"resolution":{"required":true,"name":"Решение","schema":{"type":"resolution"},
			"allowedValues":[{"id":"1","name":"Готово","iconUrl":"https://jira.example.com/images/icons/a.svg"}]}}}
	]}`}
	screen, err := loadRHSTransitionScreen(testRHSIconInstance("https://jira.example.com"), client, "AUTOPS-7", "41")
	require.NoError(t, err)
	assert.Equal(t, "2/issue/AUTOPS-7/transitions", client.getEndpoint)
	assert.Equal(t, "transitions.fields", client.getParams["expand"])
	assert.Equal(t, "41", client.getParams["transitionId"])

	require.Contains(t, screen.Fields, "resolution")
	assert.Equal(t, true, screen.Fields["resolution"]["required"])
	option := screen.Fields["resolution"]["allowedValues"].([]interface{})[0].(map[string]interface{})
	assert.Contains(t, option["iconUrl"], "/rhs/icon?", "option icons go through the plugin server")

	screen, err = loadRHSTransitionScreen(testInstance1, client, "AUTOPS-7", "31")
	require.NoError(t, err)
	assert.Empty(t, screen.Fields, "a transition without a screen has no fields")
}

func TestRunRHSTransition(t *testing.T) {
	client := &testTransitionClient{}
	require.NoError(t, runRHSTransition(client, "A-1", &rhsIssueRequest{TransitionID: "11"}))
	assert.Equal(t, "11", client.plainID, "no form values: a plain transition")
	assert.Empty(t, client.runID)

	fields := map[string]interface{}{"resolution": map[string]interface{}{"id": "1"}}
	require.NoError(t, runRHSTransition(client, "A-1", &rhsIssueRequest{TransitionID: "41", Fields: fields, Comment: "готово"}))
	assert.Equal(t, "A-1", client.runKey)
	assert.Equal(t, "41", client.runID)
	assert.Equal(t, fields, client.runFields)
	assert.Equal(t, "готово", client.runComment)
}

func TestRunRHSTransitionRejectsLongComment(t *testing.T) {
	err := runRHSTransition(&testTransitionClient{}, "A-1", &rhsIssueRequest{
		TransitionID: "41",
		Comment:      strings.Repeat("a", rhsMaxCommentLength+1),
	})
	assert.ErrorIs(t, err, ErrInvalidRHSTab)
}

type testPlainClient struct{ testClient }

func TestRunRHSTransitionWithoutRunner(t *testing.T) {
	err := runRHSTransition(&testPlainClient{}, "A-1", &rhsIssueRequest{TransitionID: "41", Comment: "x"})
	assert.True(t, errors.Is(err, ErrRHSUnsupportedInstance))
}
