// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	jira "github.com/andygrunwald/go-jira"
	"github.com/pkg/errors"
)

// serverSearchResult is GET /rest/api/2/search on Jira Server / Data Center.
// Unlike Cloud it paginates by offset and reports a total.
type serverSearchResult struct {
	Issues     []jira.Issue `json:"issues"`
	StartAt    int          `json:"startAt"`
	MaxResults int          `json:"maxResults"`
	Total      int          `json:"total"`
}

// ListStatuses implements rhsStatusLister for Jira Server / Data Center.
func (client jiraServerClient) ListStatuses() ([]*JiraStatus, error) {
	var result []*JiraStatus
	if err := client.RESTGet("2/status", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ListStatusCategories implements rhsStatusLister for Jira Server / Data Center.
func (client jiraServerClient) ListStatusCategories() ([]*JiraStatusCategory, error) {
	var result []*JiraStatusCategory
	if err := client.RESTGet("2/statuscategory", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// parseRHSPageToken decodes the offset the RHS uses as a page token on
// Server / DC. The token is the startAt of the next page encoded as a decimal
// string, so the webapp can treat it as an opaque cursor exactly like Cloud's.
func parseRHSPageToken(token string) (int, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return 0, nil
	}
	startAt, err := strconv.Atoi(token)
	if err != nil || startAt < 0 {
		return 0, errors.Wrapf(ErrInvalidRHSPageToken, "%q", token)
	}
	return startAt, nil
}

// SearchJQL implements rhsClient for Jira Server / Data Center via
// GET /rest/api/2/search. The offset pagination is mapped onto the Cloud
// shape (nextPageToken + isLast) so the RHS webapp stays identical.
func (client jiraServerClient) SearchJQL(params CloudSearchParams) (*CloudSearchResult, error) {
	startAt, err := parseRHSPageToken(params.NextPageToken)
	if err != nil {
		return nil, err
	}

	endpoint, err := endpointURL("2/search")
	if err != nil {
		return nil, err
	}

	req, err := client.Jira.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Set("jql", params.JQL)
	if len(params.Fields) > 0 {
		q.Set("fields", strings.Join(params.Fields, ","))
	}
	if params.MaxResults > 0 {
		q.Set("maxResults", strconv.Itoa(params.MaxResults))
	}
	if startAt > 0 {
		q.Set("startAt", strconv.Itoa(startAt))
	}
	req.URL.RawQuery = q.Encode()

	resp, doErr := client.Jira.Do(req, nil)
	if resp != nil && resp.StatusCode == http.StatusTooManyRequests {
		closeJiraResp(resp)
		return nil, ErrRateLimited
	}
	if doErr != nil {
		if resp != nil {
			wrapped := userFriendlyJiraError(resp, doErr)
			closeJiraResp(resp)
			return nil, wrapped
		}
		return nil, doErr
	}

	var result serverSearchResult
	decErr := json.NewDecoder(resp.Body).Decode(&result)
	closeJiraResp(resp)
	if decErr != nil {
		return nil, decErr
	}

	return normalizeServerSearchResult(startAt, result), nil
}

// normalizeServerSearchResult converts offset pagination to the Cloud shape.
// Jira may ignore the requested startAt (it echoes the effective one), so the
// response value wins when present.
func normalizeServerSearchResult(requestedStartAt int, result serverSearchResult) *CloudSearchResult {
	startAt := result.StartAt
	if startAt == 0 && requestedStartAt > 0 && len(result.Issues) > 0 {
		startAt = requestedStartAt
	}
	next := startAt + len(result.Issues)
	isLast := len(result.Issues) == 0 || next >= result.Total

	total := result.Total
	out := &CloudSearchResult{
		Issues: result.Issues,
		IsLast: isLast,
		Total:  &total,
	}
	if !isLast {
		out.NextPageToken = strconv.Itoa(next)
	}
	return out
}

// GetRHSIcon implements rhsIconFetcher. The body is an image, not JSON, so it
// is read here rather than decoded by the Jira client.
func (client jiraServerClient) GetRHSIcon(iconPath string) (string, []byte, error) {
	req, err := client.Jira.NewRequest(http.MethodGet, iconPath, nil)
	if err != nil {
		return "", nil, err
	}
	resp, err := client.Jira.Do(req, nil)
	if resp != nil && resp.Body != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return "", nil, userFriendlyJiraError(resp, err)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, rhsIconMaxBytes+1))
	if err != nil {
		return "", nil, errors.Wrap(err, "failed to read the icon")
	}
	if len(data) > rhsIconMaxBytes {
		return "", nil, ErrRHSIconTooLarge
	}
	return resp.Header.Get("Content-Type"), data, nil
}
