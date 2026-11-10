// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

// rhsConnectedUsers counts the Mattermost users connected to each Jira
// instance, and those connected to any. The records of users who
// disconnected from everything stay in the store with no instances; they
// are not counted.
func (p *Plugin) rhsConnectedUsers() (perInstance map[types.ID]int, total int, err error) {
	perInstance = map[types.ID]int{}
	for page := 0; ; page++ {
		keys, listErr := p.client.KV.ListKeys(page, listPerPage)
		if listErr != nil {
			return nil, 0, listErr
		}
		for _, key := range keys {
			if !strings.HasPrefix(key, prefixUser) {
				continue
			}
			user := NewUser("")
			if getErr := p.client.KV.Get(key, user); getErr != nil || user.ConnectedInstances == nil {
				continue
			}
			ids := user.ConnectedInstances.IDs()
			if len(ids) == 0 {
				continue
			}
			total++
			for _, id := range ids {
				perInstance[id]++
			}
		}
		if len(keys) < listPerPage {
			return perInstance, total, nil
		}
	}
}
