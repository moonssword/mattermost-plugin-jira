// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	jira "github.com/andygrunwald/go-jira"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

const (
	routeAPIRHSAttachment  = "/rhs/attachment"
	queryRHSAttachmentID   = "id"
	queryRHSAttachmentFile = "file"

	// queryRHSAttachmentName is not read back: Mattermost's viewer and message
	// renderer take a file's type from the end of its address. Values.Encode
	// sorts the keys, so this one stays last.
	queryRHSAttachmentName = "name"

	rhsAttachmentCacheSecs = 60 * 60

	rhsErrFileTooLarge = "file_too_large"
	rhsJiraTimeLayout  = "2006-01-02T15:04:05.000-0700"

	// Room for the multipart boundary and the other form values.
	rhsAttachmentFormOverhead = 1 << 16
)

// Types the browser may show on the Mattermost origin. Anything else, SVG
// above all, is downloaded.
var rhsInlineImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
	"image/bmp":  true,
}

// RHSAttachment is a file of the issue as the card lists it.
type RHSAttachment struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	URL   string `json:"url"`
	Image bool   `json:"image"`

	Size    int    `json:"size,omitempty"`
	Created string `json:"created,omitempty"`
}

// rhsAttachmentFetcher is implemented by the clients of Jira instances the
// browser may not reach or may not be signed in to.
type rhsAttachmentFetcher interface {
	OpenRHSAttachment(id, filename string) (io.ReadCloser, error)
}

func (p *Plugin) registerRHSAttachmentRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSAttachment, p.checkAuth(p.handleResponse(p.httpRHSAddAttachment))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIRHSAttachment, p.checkAuth(p.handleResponse(p.httpRHSGetAttachment))).Methods(http.MethodGet)
}

func rhsAttachmentIsImage(a *jira.Attachment) bool {
	return rhsInlineImageTypes[strings.ToLower(a.MimeType)]
}

// rhsNewestAttachments sorts files newest first. Files added within the same
// millisecond keep the order of their ids, which Jira hands out in sequence.
func rhsNewestAttachments(attachments []*jira.Attachment) []*jira.Attachment {
	type dated struct {
		file *jira.Attachment
		at   time.Time
		id   int
	}
	sorted := make([]dated, 0, len(attachments))
	for _, a := range attachments {
		if a == nil || a.ID == "" {
			continue
		}
		at, _ := time.Parse(rhsJiraTimeLayout, a.Created)
		id, _ := strconv.Atoi(a.ID)
		sorted = append(sorted, dated{a, at, id})
	}
	sort.SliceStable(sorted, func(i, j int) bool {
		if !sorted[i].at.Equal(sorted[j].at) {
			return sorted[i].at.After(sorted[j].at)
		}
		return sorted[i].id > sorted[j].id
	})
	out := make([]*jira.Attachment, 0, len(sorted))
	for _, d := range sorted {
		out = append(out, d.file)
	}
	return out
}

// rhsAttachments lists the issue's files with addresses on the plugin server,
// and indexes them by name for the markup. The newest file wins, as in Jira.
func rhsAttachments(instance Instance, issueKey string, attachments []*jira.Attachment) ([]RHSAttachment, map[string]rhsMarkupFile) {
	list := []RHSAttachment{}
	files := map[string]rhsMarkupFile{}
	common := instance.Common()
	if common.Type != ServerInstanceType || common.Plugin == nil {
		return list, files
	}

	sitePath := ""
	if site, err := url.Parse(common.Plugin.GetSiteURL()); err == nil {
		sitePath = strings.TrimRight(site.Path, "/")
	}
	for _, a := range rhsNewestAttachments(attachments) {
		query := url.Values{}
		query.Set(ParamInstanceID, instance.GetID().String())
		query.Set(queryRHSIssueKey, issueKey)
		query.Set(queryRHSAttachmentID, a.ID)
		query.Set(queryRHSAttachmentName, a.Filename)
		route := routeAPI + routeAPIRHSAttachment + "?" + query.Encode()

		relative := sitePath + common.Plugin.GetPluginURLPath() + route
		list = append(list, RHSAttachment{
			ID:      a.ID,
			Name:    a.Filename,
			URL:     relative,
			Image:   rhsAttachmentIsImage(a),
			Size:    a.Size,
			Created: jiraCommentTime(a.Created),
		})
		if _, taken := files[a.Filename]; !taken {
			files[a.Filename] = rhsMarkupFile{
				URL:         relative,
				AbsoluteURL: common.Plugin.GetPluginURL() + route,
				Image:       rhsAttachmentIsImage(a),
			}
		}
	}
	return list, files
}

var rhsAttachmentNameCleaner = strings.NewReplacer("!", "_", "|", "_", "[", "_", "]", "_", "{", "_", "}", "_", "/", "_", "\\", "_")

// rhsAttachmentName keeps a file name usable in wiki references like !name!.
// The webapp's rhsFileName does the same before it writes the reference.
func rhsAttachmentName(name string) string {
	name = strings.TrimSpace(rhsAttachmentNameCleaner.Replace(name))
	if name == "" {
		return "file"
	}
	return name
}

// httpRHSAddAttachment attaches a file to an issue with the user's own token.
// It replies with the issue card, as the other card actions do.
func (p *Plugin) httpRHSAddAttachment(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	limit := int64(p.getConfig().maxAttachmentSize)
	r.Body = http.MaxBytesReader(w, r.Body, limit+rhsAttachmentFormOverhead)
	file, header, err := r.FormFile(queryRHSAttachmentFile)
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return respondJSONErr(w, http.StatusRequestEntityTooLarge, rhsErrFileTooLarge, "file is too large")
		}
		return respondJSONErr(w, http.StatusBadRequest, rhsErrInvalidRequest, "no file in the request")
	}
	defer file.Close()
	if header.Size > limit {
		return respondJSONErr(w, http.StatusRequestEntityTooLarge, rhsErrFileTooLarge, "file is too large")
	}

	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	if _, err = ctx.client.RESTPostAttachment(ctx.key, file, rhsAttachmentName(header.Filename)); err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	card, err := p.loadRHSIssueCard(ctx)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, card)
}

// httpRHSGetAttachment serves a file through the plugin server. The file must
// belong to an issue the user can open in Jira: the issue is read with the
// user's own token first.
func (p *Plugin) httpRHSGetAttachment(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := types.ID(r.Header.Get(HeaderMattermostUserID))
	ctx, err := p.rhsIssueContext(types.ID(r.FormValue(ParamInstanceID)), userID, r.FormValue(queryRHSIssueKey))
	if err != nil {
		return respondRHSErr(w, err)
	}
	fetcher, ok := ctx.client.(rhsAttachmentFetcher)
	if !ok {
		return respondJSONErr(w, http.StatusBadRequest, rhsErrUnsupported, "attachments are not served for this instance")
	}
	issue, err := ctx.client.GetIssue(ctx.key, &jira.GetQueryOptions{Fields: "attachment"})
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}

	var attachment *jira.Attachment
	if issue.Fields != nil {
		for _, a := range issue.Fields.Attachments {
			if a != nil && a.ID == r.FormValue(queryRHSAttachmentID) {
				attachment = a
				break
			}
		}
	}
	if attachment == nil {
		return respondJSONErr(w, http.StatusNotFound, rhsErrNotFound, "attachment not found")
	}

	body, err := fetcher.OpenRHSAttachment(attachment.ID, attachment.Filename)
	if err != nil {
		return respondRHSErr(w, rhsJiraError(err))
	}
	defer body.Close()

	contentType, disposition := "application/octet-stream", "attachment"
	if rhsAttachmentIsImage(attachment) {
		contentType, disposition = strings.ToLower(attachment.MimeType), "inline"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": path.Base(attachment.Filename)}))
	w.Header().Set("Cache-Control", "private, max-age="+strconv.Itoa(rhsAttachmentCacheSecs))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	if _, err = io.Copy(w, body); err != nil {
		return http.StatusInternalServerError, errors.Wrap(err, "failed to write the attachment")
	}
	return http.StatusOK, nil
}
