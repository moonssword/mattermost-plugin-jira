// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTranslateRHSRussian(t *testing.T) {
	for in, out := range map[string]string{
		"Admin **assigned** you to ошибка [K-1: тема](u)":                                             "Admin **назначил(а)** вас исполнителем: ошибка [K-1: тема](u)",
		"Admin **commented** on ошибка [K-1](u)":                                                      "Admin **прокомментировал(а)**: ошибка [K-1](u)",
		"Admin **commented** on задача [K-1](u):\n> **created** text":                                 "Admin **прокомментировал(а)**: задача [K-1](u)\n> **created** text",
		"Admin **commented** on задача [K-1](u):\n> q\n\n*You reported this задача*":                  "Admin **прокомментировал(а)**: задача [K-1](u)\n> q\n\n*Вы автор этой задачи (задача)*",
		"Admin **mentioned** you in a new comment on задача [K-1](u)":                                 "Admin **упомянул(а)** вас в новом комментарии: задача [K-1](u)",
		"Admin **updated** Fix Version from \"a\" to \"b\" on задача [K-1](u)":                        "Admin **изменил(а)** поле «Fix Version» с «a» на «b»: задача [K-1](u)",
		"Admin **updated** задача [K-1](u)":                                                           "Admin **обновил(а)**: задача [K-1](u)",
		"Current settings:\n\t- Notifications for assignee: on \n\t- Notifications for watching: off": "Текущие настройки:\n\t- Уведомления исполнителю: вкл. \n\t- Уведомления наблюдателю: выкл.",
		"`/jira setup` can only be run by a system administrator.":                                    "Команду `/jira setup` может выполнить только системный администратор.",
		"something new": "something new",
	} {
		assert.Equal(t, out, translateRHSRussian(in))
	}
}

func TestLocalizeIsOffWithoutActivation(t *testing.T) {
	p := &Plugin{}
	assert.Equal(t, "Share publicly", p.localizeForChannel("Share publicly"))
	assert.Equal(t, "Share publicly", p.localizeForUser("id", "Share publicly"))
	var missing *Plugin
	assert.Equal(t, "Share publicly", missing.localizeForChannel("Share publicly"))
}
