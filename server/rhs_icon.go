// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

const (
	routeAPIRHSIcon  = "/rhs/icon"
	queryRHSIconPath = "path"

	rhsIconMaxBytes     = 1 << 20
	rhsIconCacheSeconds = 24 * 60 * 60
	rhsImageTypePrefix  = "image/"
)

var (
	ErrRHSIconTooLarge = errors.New("jira icon is too large")

	// The only Jira paths the icon route reads, so that it cannot be used to
	// fetch anything else on behalf of the user.
	rhsIconPathPrefixes = []string{"/images/icons/", "/rest/api/2/universal_avatar/"}
	rhsIconPaths        = []string{"/secure/viewavatar", "/secure/projectavatar"}
)

// rhsIconFetcher is implemented by the clients of Jira instances the browser
// may not reach or may not be signed in to.
type rhsIconFetcher interface {
	GetRHSIcon(iconPath string) (contentType string, data []byte, err error)
}

func isRHSIconPath(p string) bool {
	if p == "" || path.Clean(p) != p {
		return false
	}
	for _, allowed := range rhsIconPaths {
		if p == allowed {
			return true
		}
	}
	for _, prefix := range rhsIconPathPrefixes {
		if strings.HasPrefix(p, prefix) {
			return true
		}
	}
	return false
}

// parseRHSIconPath accepts only a relative, allowed path and returns it
// re-encoded, without anything else the request parameter may have carried.
func parseRHSIconPath(raw string) (string, bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "" || parsed.Host != "" || parsed.User != nil || parsed.Fragment != "" {
		return "", false
	}
	if !isRHSIconPath(parsed.Path) {
		return "", false
	}
	return (&url.URL{Path: parsed.Path, RawQuery: parsed.RawQuery}).String(), true
}

// rhsIconURL points a Jira Server / Data Center icon at the plugin server, as
// the browser talks to Jira only through it. Other URLs stay as they are.
func rhsIconURL(instance Instance, raw string) string {
	common := instance.Common()
	if raw == "" || common.Type != ServerInstanceType || common.Plugin == nil {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return raw
	}
	base, err := url.Parse(instance.GetURL())
	if err != nil {
		return raw
	}
	iconPath := strings.TrimPrefix(parsed.Path, strings.TrimRight(base.Path, "/"))
	if !isRHSIconPath(iconPath) {
		return raw
	}

	// Relative to the page: the site URL may differ from the address in use.
	sitePath := ""
	if site, siteErr := url.Parse(common.Plugin.GetSiteURL()); siteErr == nil {
		sitePath = strings.TrimRight(site.Path, "/")
	}
	query := url.Values{}
	query.Set(ParamInstanceID, instance.GetID().String())
	query.Set(queryRHSIconPath, (&url.URL{Path: iconPath, RawQuery: parsed.RawQuery}).String())
	return sitePath + common.Plugin.GetPluginURLPath() + routeAPI + routeAPIRHSIcon + "?" + query.Encode()
}

func (p *Plugin) httpRHSGetIcon(w http.ResponseWriter, r *http.Request) (int, error) {
	iconPath, ok := parseRHSIconPath(r.FormValue(queryRHSIconPath))
	if !ok {
		return respondJSONErr(w, http.StatusBadRequest, rhsErrInvalidRequest, "invalid icon path")
	}
	_, client, err := p.rhsBoardClient(r)
	if err != nil {
		return respondRHSErr(w, err)
	}
	fetcher, ok := client.(rhsIconFetcher)
	if !ok {
		return respondJSONErr(w, http.StatusBadRequest, rhsErrUnsupported, "icons are not served for this instance")
	}
	return serveRHSIcon(w, fetcher, iconPath)
}

func serveRHSIcon(w http.ResponseWriter, fetcher rhsIconFetcher, iconPath string) (int, error) {
	contentType, data, err := fetcher.GetRHSIcon(iconPath)
	if err != nil {
		return respondRHSErr(w, err)
	}
	if !strings.HasPrefix(strings.ToLower(contentType), rhsImageTypePrefix) {
		return respondJSONErr(w, http.StatusNotFound, rhsErrNotFound, "not an image")
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age="+strconv.Itoa(rhsIconCacheSeconds))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// An SVG opened directly on the Mattermost origin must not run scripts.
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	if _, err = w.Write(data); err != nil {
		return http.StatusInternalServerError, errors.Wrap(err, "failed to write the icon")
	}
	return http.StatusOK, nil
}
