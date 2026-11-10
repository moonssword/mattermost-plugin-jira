// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
)

func TestJiraFormatFollowsServerLanguage(t *testing.T) {
	for locale, want := range map[string]string{
		"ru": "*@Admin приложил(а)* [сообщение|http://mm/pl/1] *от @anna*\n",
		"en": "*@Admin attached a* [message|http://mm/pl/1] *from @anna*\n",
	} {
		api := &plugintest.API{}
		p := setupTestPlugin(api)
		p.localizeMessages = true
		api.On("GetConfig").Return(&model.Config{LocalizationSettings: model.LocalizationSettings{DefaultServerLocale: model.NewPointer(locale)}})

		got := fmt.Sprintf(p.jiraFormat("*@%s attached a* [message|%s] *from @%s*\n"), "Admin", "http://mm/pl/1", "anna")
		assert.Equal(t, want, got, locale)
	}

	p := &Plugin{}
	assert.Equal(t, "_Issue created from a [message in Mattermost|%v]_.", p.jiraFormat("_Issue created from a [message in Mattermost|%v]_."))
	for format, translated := range rhsRussianJiraFormats {
		assert.Equal(t, countVerbs(format), countVerbs(translated), format)
	}
}

func countVerbs(format string) int {
	n := 0
	for i := 0; i < len(format)-1; i++ {
		if format[i] == '%' {
			n++
			i++
		}
	}
	return n
}
