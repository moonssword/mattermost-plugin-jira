// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

// What the plugin itself writes into Jira: the note on an issue created from
// a message and the comment of an attached message. Jira users read it like a
// channel, so it follows the default language of the Mattermost server.
var rhsRussianJiraFormats = map[string]string{
	"\n\n_Issue created from a [message in Mattermost|%v]_.": "\n\n_Задача создана из [сообщения в Mattermost|%v]_.",
	"_Issue created from a [message in Mattermost|%v]_.":     "_Задача создана из [сообщения в Mattermost|%v]_.",
	"*@%s attached a* [message|%s] *from @%s*\n":             "*@%s приложил(а)* [сообщение|%s] *от @%s*\n",
}

// jiraFormat gives the format string of a text written into Jira in the
// server's language.
func (p *Plugin) jiraFormat(format string) string {
	if p == nil || !p.localizeMessages || p.rhsServerLanguage() != rhsLanguageRussian {
		return format
	}
	if translated, ok := rhsRussianJiraFormats[format]; ok {
		return translated
	}
	return format
}
