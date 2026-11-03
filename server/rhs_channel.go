// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// Channel section of the RHS: every channel member sees the subscriptions,
// only users allowed by RolesAllowedToEditJiraSubscriptions change them.
const (
	routeAPIRHSChannelSubscriptions = "/rhs/channel/subscriptions"
	routeAPIRHSSubscriptionPause    = "/rhs/channel/subscription/pause"

	queryRHSChannelID = "channel_id"
)

var ErrRHSNotChannelMember = errors.New("not a member of the channel")

func (p *Plugin) registerRHSChannelRoutes(apiRouter *mux.Router) {
	apiRouter.HandleFunc(routeAPIRHSChannelSubscriptions, p.checkAuth(p.handleResponse(p.httpRHSChannelSubscriptions))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIRHSSubscriptionPause, p.checkAuth(p.handleResponse(p.httpRHSPauseSubscription))).Methods(http.MethodPost)
}

type RHSChannelSubscription struct {
	ChannelSubscription
	PausedByName string `json:"paused_by_name,omitempty"`
}

type rhsChannelSubscriptionsResult struct {
	Subscriptions []RHSChannelSubscription `json:"subscriptions"`
	CanManage     bool                     `json:"can_manage"`
}

func (p *Plugin) checkRHSChannelMember(channelID, userID string) error {
	if len(channelID) != 26 {
		return errors.Wrap(ErrInvalidRHSTab, "bad channel id")
	}
	if _, err := p.client.Channel.GetMember(channelID, userID); err != nil {
		return ErrRHSNotChannelMember
	}
	return nil
}

func (p *Plugin) rhsUserDisplayName(userID string) string {
	if userID == "" {
		return ""
	}
	user, err := p.client.User.Get(userID)
	if err != nil || user == nil {
		return ""
	}
	if name := user.GetFullName(); name != "" {
		return name
	}
	return "@" + user.Username
}

func (p *Plugin) getRHSChannelSubscriptions(instanceID types.ID, channelID, userID string) (*rhsChannelSubscriptionsResult, error) {
	if err := p.checkRHSChannelMember(channelID, userID); err != nil {
		return nil, err
	}
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return nil, err
	}
	subs, err := p.getSubscriptionsForChannel(instanceID, channelID)
	if err != nil {
		return nil, err
	}

	names := map[string]string{}
	out := make([]RHSChannelSubscription, 0, len(subs))
	for _, sub := range subs {
		view := RHSChannelSubscription{ChannelSubscription: sub}
		if sub.Paused && sub.PausedBy != "" {
			if _, ok := names[sub.PausedBy]; !ok {
				names[sub.PausedBy] = p.rhsUserDisplayName(sub.PausedBy)
			}
			view.PausedByName = names[sub.PausedBy]
		}
		out = append(out, view)
	}
	return &rhsChannelSubscriptionsResult{
		Subscriptions: out,
		CanManage:     p.hasPermissionToManageSubscription(instanceID, userID, channelID) == nil,
	}, nil
}

func (p *Plugin) httpRHSChannelSubscriptions(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := r.Header.Get(HeaderMattermostUserID)
	result, err := p.getRHSChannelSubscriptions(types.ID(r.FormValue(ParamInstanceID)), r.FormValue(queryRHSChannelID), userID)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, result)
}

type rhsPauseRequest struct {
	InstanceID     string `json:"instance_id"`
	ChannelID      string `json:"channel_id"`
	SubscriptionID string `json:"subscription_id"`
	Paused         bool   `json:"paused"`
}

// setChannelSubscriptionPaused pauses or resumes one subscription of a
// channel; the subscription must belong to that channel.
func (p *Plugin) setChannelSubscriptionPaused(instanceID types.ID, channelID, subscriptionID, userID string, paused bool, now time.Time) error {
	subKey := keyWithInstanceID(instanceID, JiraSubscriptionsKey)
	return p.client.KV.SetAtomicWithRetries(subKey, func(initialBytes []byte) (interface{}, error) {
		subs, err := SubscriptionsFromJSON(initialBytes, instanceID)
		if err != nil {
			return nil, err
		}
		sub, ok := subs.Channel.ByID[subscriptionID]
		if !ok || sub.ChannelID != channelID {
			return nil, errors.Wrap(ErrRHSIssueNotFound, "subscription not found in this channel")
		}
		sub.Paused = paused
		if paused {
			sub.PausedAt = now.UnixMilli()
			sub.PausedBy = userID
		} else {
			sub.PausedAt = 0
			sub.PausedBy = ""
		}
		subs.Channel.ByID[subscriptionID] = sub
		return json.Marshal(&subs)
	})
}

func (p *Plugin) httpRHSPauseSubscription(w http.ResponseWriter, r *http.Request) (int, error) {
	userID := r.Header.Get(HeaderMattermostUserID)
	var in rhsPauseRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&in); err != nil || in.SubscriptionID == "" {
		return respondRHSErr(w, errors.Wrap(ErrInvalidRHSTab, "invalid request body"))
	}
	instanceID := types.ID(in.InstanceID)
	if err := p.checkRHSChannelMember(in.ChannelID, userID); err != nil {
		return respondRHSErr(w, err)
	}
	if _, err := p.loadRHSInstance(instanceID); err != nil {
		return respondRHSErr(w, err)
	}
	if err := p.hasPermissionToManageSubscription(instanceID, userID, in.ChannelID); err != nil {
		return respondJSONErr(w, http.StatusForbidden, rhsErrForbidden, "you are not allowed to manage Jira subscriptions in this channel")
	}
	if err := p.setChannelSubscriptionPaused(instanceID, in.ChannelID, in.SubscriptionID, userID, in.Paused, time.Now()); err != nil {
		return respondRHSErr(w, err)
	}
	result, err := p.getRHSChannelSubscriptions(instanceID, in.ChannelID, userID)
	if err != nil {
		return respondRHSErr(w, err)
	}
	return respondJSON(w, result)
}
