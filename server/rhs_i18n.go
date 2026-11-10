// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// Translation of what the plugin server writes: direct messages, channel posts
// and slash command replies. The upstream code keeps composing English; the
// messages are translated at the points where they leave the plugin, so its
// format strings double as the keys of the catalog.
//
// A user's own message follows the language chosen in the panel (the
// Mattermost language by default). A channel is read by many people, so
// channel posts follow the default language of the server.

const (
	rhsPreferenceCategory = "pp_jira"
	rhsPreferenceLanguage = "language"
	rhsLanguageAuto       = "auto"
	rhsLanguageRussian    = "ru"
)

type rhsTranslation struct {
	pattern *regexp.Regexp
	text    string
}

var rhsPlaceholder = regexp.MustCompile(`%[svdq]`)

// compileRHSTranslation turns "%s did %q" into a pattern; {1}, {2}... in the
// translation are the placeholders in order.
func compileRHSTranslation(format, text string) rhsTranslation {
	var b strings.Builder
	b.WriteString(`(?s)^`)
	last := 0
	for _, span := range rhsPlaceholder.FindAllStringIndex(format, -1) {
		b.WriteString(regexp.QuoteMeta(format[last:span[0]]))
		if format[span[0]:span[1]] == "%q" {
			b.WriteString(`"(.*?)"`)
		} else {
			b.WriteString(`(.*?)`)
		}
		last = span[1]
	}
	b.WriteString(regexp.QuoteMeta(format[last:]))
	b.WriteString(`$`)
	return rhsTranslation{pattern: regexp.MustCompile(b.String()), text: text}
}

func (t rhsTranslation) apply(message string) (string, bool) {
	parts := t.pattern.FindStringSubmatch(message)
	if parts == nil {
		return "", false
	}
	out := t.text
	for i := 1; i < len(parts); i++ {
		out = strings.ReplaceAll(out, "{"+strconv.Itoa(i)+"}", parts[i])
	}
	return out, true
}

var rhsRussianCatalog = func() []rhsTranslation {
	out := make([]rhsTranslation, 0, len(rhsRussianMessages))
	for _, pair := range rhsRussianMessages {
		out = append(out, compileRHSTranslation(pair[0], pair[1]))
	}
	return out
}()

// rhsRussianLines are rules for single lines only: ending in a value, they
// would take a whole message of several lines for that value.
var rhsRussianLines = [][2]string{
	{" * Mattermost site URL: %s", " * Адрес Mattermost: {1}"},
	{" * Mattermost user ID: %s", " * ID пользователя Mattermost: {1}"},
	{" * %s: Server, connected as **%s** (Name:%s, Key:%s, EmailAddress:%s)", " * {1}: Data Center, подключён как **{2}** (логин: {3}, ключ: {4}, почта: {5})"},
	{" * %s: Cloud, connected as **%s** (AccountID: %s)", " * {1}: Cloud, подключён как **{2}** (AccountID: {3})"},
	{"   * \t- Notifications for assignee: on ", "   * \t- Уведомления исполнителю: вкл. "},
	{"   * \t- Notifications for assignee: off ", "   * \t- Уведомления исполнителю: выкл. "},
	{"   * Default project: %s", "   * Проект по умолчанию: {1}"},
	{"###### Available Jira instances:", "###### Установленные инстансы Jira:"},
	{" * %s: server (%s)", " * {1}: Data Center ({2})"},
	{" * %s: cloud (%s)", " * {1}: Cloud ({2})"},
}

// rhsRussianLineCatalog holds the line rules, then the message rules.
var rhsRussianLineCatalog = func() []rhsTranslation {
	out := make([]rhsTranslation, 0, len(rhsRussianLines)+len(rhsRussianCatalog))
	for _, pair := range rhsRussianLines {
		out = append(out, compileRHSTranslation(pair[0], pair[1]))
	}
	return append(out, rhsRussianCatalog...)
}()

// translateRHSRussian translates a whole message, or else its lines one by
// one. Quoted text is safe: it sits in a placeholder of a whole-message rule.
func translateRHSRussian(message string) string {
	for _, t := range rhsRussianCatalog {
		if out, ok := t.apply(message); ok {
			return out
		}
	}
	lines := strings.Split(message, "\n")
	for i, line := range lines {
		for _, t := range rhsRussianLineCatalog {
			if out, ok := t.apply(line); ok {
				lines[i] = out
				break
			}
		}
	}
	return strings.Join(lines, "\n")
}

func rhsLanguageOfLocale(locale string) string {
	if strings.HasPrefix(strings.ToLower(locale), rhsLanguageRussian) {
		return rhsLanguageRussian
	}
	return "en"
}

// rhsUserLanguage mirrors getUILanguage of the webapp.
func (p *Plugin) rhsUserLanguage(mattermostUserID string) string {
	preference, appErr := p.API.GetPreferenceForUser(mattermostUserID, rhsPreferenceCategory, rhsPreferenceLanguage)
	if appErr == nil && preference.Value != "" && preference.Value != rhsLanguageAuto {
		return preference.Value
	}
	user, appErr := p.API.GetUser(mattermostUserID)
	if appErr != nil || user.Locale == "" {
		return p.rhsServerLanguage()
	}
	return rhsLanguageOfLocale(user.Locale)
}

// rhsServerLanguage is the language of posts everyone reads: the default
// language of the Mattermost interface (DefaultClientLocale), which is what
// people see; DefaultServerLocale, the language of server messages, often
// stays English while the interface is Russian.
func (p *Plugin) rhsServerLanguage() string {
	settings := p.API.GetConfig().LocalizationSettings
	if settings.DefaultClientLocale != nil && *settings.DefaultClientLocale != "" {
		return rhsLanguageOfLocale(*settings.DefaultClientLocale)
	}
	if settings.DefaultServerLocale != nil {
		return rhsLanguageOfLocale(*settings.DefaultServerLocale)
	}
	return "en"
}

// localizeForUser translates a message addressed to one user.
func (p *Plugin) localizeForUser(mattermostUserID, message string) string {
	if p == nil || !p.localizeMessages || p.rhsUserLanguage(mattermostUserID) != rhsLanguageRussian {
		return message
	}
	return translateRHSRussian(message)
}

// localizeForChannel translates a message everyone in a channel reads.
func (p *Plugin) localizeForChannel(message string) string {
	if p == nil || !p.localizeMessages || p.rhsServerLanguage() != rhsLanguageRussian {
		return message
	}
	return translateRHSRussian(message)
}

var (
	rhsFieldLine = regexp.MustCompile(`^\*\*([^*\n]+):\*\* `)

	rhsRussianFieldTitles = map[string]string{
		"Affects Version": "Затронутая версия",
		"Assignee":        "Исполнитель",
		"Attachments":     "Вложения",
		"Component":       "Компонент",
		"Description":     "Описание",
		"Due Date":        "Срок",
		"Duedate":         "Срок",
		"Environment":     "Окружение",
		"Fix Version":     "Исправить в версии",
		"Issuetype":       "Тип задачи",
		"Labels":          "Метки",
		"Link":            "Связь",
		"Priority":        "Приоритет",
		"Rank":            "Ранг",
		"Reopened":        "Открыта снова",
		"Reporter":        "Автор",
		"Resolution":      "Решение",
		"Resolved":        "Решена",
		"Sprint":          "Спринт",
		"Status":          "Статус",
		"Summary":         "Тема",
	}
	rhsRussianFieldValues = strings.NewReplacer(
		"~~Open~~", "~~Открыта~~",
		"~~None~~", "~~Нет~~",
		Nobody, "_никто_",
	)
)

// localizeRHSFields translates the field block of a channel post; the values
// come from Jira and keep their language.
func (p *Plugin) localizeRHSFields(fields []*model.SlackAttachmentField) []*model.SlackAttachmentField {
	if p == nil || !p.localizeMessages || p.rhsServerLanguage() != rhsLanguageRussian {
		return fields
	}
	out := make([]*model.SlackAttachmentField, 0, len(fields))
	for _, f := range fields {
		field := *f
		if title := rhsRussianFieldTitles[field.Title]; title != "" {
			field.Title = title
		}
		if value, ok := field.Value.(string); ok {
			if parts := rhsFieldLine.FindStringSubmatch(value); parts != nil && rhsRussianFieldTitles[parts[1]] != "" {
				value = "**" + rhsRussianFieldTitles[parts[1]] + ":** " + value[len(parts[0]):]
			}
			value = rhsRussianFieldValues.Replace(value)
			if strings.HasSuffix(value, " Open") {
				value = strings.TrimSuffix(value, "Open") + "Открыта"
			}
			field.Value = value
		}
		out = append(out, &field)
	}
	return out
}

// localizeRHSAutocomplete translates the hints of the /jira command, which are
// registered once for the whole server.
func (p *Plugin) localizeRHSAutocomplete(data *model.AutocompleteData) {
	if data == nil {
		return
	}
	data.HelpText = p.localizeForChannel(data.HelpText)
	for _, argument := range data.Arguments {
		argument.HelpText = p.localizeForChannel(argument.HelpText)
		if list, ok := argument.Data.(*model.AutocompleteStaticListArg); ok {
			for i := range list.PossibleArguments {
				list.PossibleArguments[i].HelpText = p.localizeForChannel(list.PossibleArguments[i].HelpText)
			}
		}
	}
	for _, sub := range data.SubCommands {
		p.localizeRHSAutocomplete(sub)
	}
}

// rhsDevModeCommandText answers /jira for users outside the development mode list.
const rhsDevModeCommandText = "The Jira plugin is in development mode and is not available to you yet."

// Order matters: a rule with more text goes before a shorter one that would
// also match it.
var rhsRussianMessages = [][2]string{
	// Personal notifications.
	{"%s **commented** on %s:\n%s\n\n*You are watching this %s*", "{1} **прокомментировал(а)**: {2}\n{3}\n\n*Вы наблюдаете за этой задачей ({4})*"},
	{"%s **commented** on %s\n\n*You are watching this %s*", "{1} **прокомментировал(а)**: {2}\n\n*Вы наблюдаете за этой задачей ({3})*"},
	{"%s **commented** on %s:\n%s\n\n*You reported this %s*", "{1} **прокомментировал(а)**: {2}\n{3}\n\n*Вы автор этой задачи ({4})*"},
	{"%s **commented** on %s\n\n*You reported this %s*", "{1} **прокомментировал(а)**: {2}\n\n*Вы автор этой задачи ({3})*"},
	{"%s **commented** on %s:\n%s", "{1} **прокомментировал(а)**: {2}\n{3}"},
	{"%s **mentioned** you in a new comment on %s:\n%s", "{1} **упомянул(а)** вас в новом комментарии: {2}\n{3}"},
	{"%s **mentioned** you in a new comment on %s", "{1} **упомянул(а)** вас в новом комментарии: {2}"},
	{"%s **assigned** you to %s", "{1} **назначил(а)** вас исполнителем: {2}"},

	// Channel posts.
	{"%s **commented** on %s", "{1} **прокомментировал(а)**: {2}"},
	{"%s **edited comment** in %s", "{1} **изменил(а) комментарий**: {2}"},
	{"%s **deleted comment** in %s", "{1} **удалил(а) комментарий**: {2}"},
	{"%s **created** %s", "{1} **создал(а)**: {2}"},
	{"%s **deleted** %s", "{1} **удалил(а)**: {2}"},
	{"%s **reopened** %s", "{1} **открыл(а) снова**: {2}"},
	{"%s **resolved** %s", "{1} **решил(а)**: {2}"},
	{"%s **assigned** %s to %s", "{1} **назначил(а)** исполнителя {2}: {3}"},
	{"%s **edited** the description of %s", "{1} **изменил(а) описание**: {2}"},
	{"%s **attached** [%s] to, **removed** attachments [%s] from %s", "{1} **прикрепил(а)** [{2}] и **удалил(а) вложения** [{3}]: {4}"},
	{"%s **attached** [%s] to %s", "{1} **прикрепил(а)** [{2}]: {3}"},
	{"%s **removed** attachments [%s] from %s", "{1} **удалил(а) вложения** [{2}]: {3}"},
	{"%s **added** labels [%s] to, **removed** labels [%s] from %s", "{1} **добавил(а) метки** [{2}] и **удалил(а) метки** [{3}]: {4}"},
	{"%s **added** labels [%s] to %s", "{1} **добавил(а) метки** [{2}]: {3}"},
	{"%s **removed** labels [%s] from %s", "{1} **удалил(а) метки** [{2}]: {3}"},
	{"%s **updated** %s from %q to %q on %s", "{1} **изменил(а)** поле «{2}» с «{3}» на «{4}»: {5}"},
	{"%s **updated** %s", "{1} **обновил(а)**: {2}"},
	{"Subscription: **%s**", "Подписка: **{1}**"},
	{"Jira subscription, \"%v\", was added to this channel by %v", "Подписка Jira «{1}» добавлена в этот канал пользователем {2}"},
	{"Jira subscription, \"%v\", was updated by %v", "Подписка Jira «{1}» изменена пользователем {2}"},
	{"Jira subscription, \"%v\", was removed from this channel by %v", "Подписка Jira «{1}» удалена из этого канала пользователем {2}"},
	{"Jira subscription template, %q, was updated by %s", "Шаблон подписки Jira «{1}» изменён пользователем {2}"},
	{"Jira subscription template, %q, was added by %s", "Шаблон подписки Jira «{1}» добавлен пользователем {2}"},
	{"Jira subscription template, %q, was removed by %s", "Шаблон подписки Jira «{1}» удалён пользователем {2}"},
	{"Created Jira issue [%s](%s)", "Создана задача Jira [{1}]({2})"},
	{"Created a Jira issue: %s", "Создана задача Jira: {1}"},
	{"Message attached to [%s](%s)", "Сообщение прикреплено к задаче [{1}]({2})"},
	{"Transition issue", "Перевести задачу"},
	{"Share publicly", "Поделиться со всеми"},

	// Direct messages about the account.
	{"You have successfully disconnected your Jira account (**%s**).", "Ваш аккаунт Jira отключён (**{1}**)."},
	{":warning: Your Jira connection has expired. Please reconnect your account using `/jira connect %s`.", ":warning: Срок подключения к Jira истёк. Подключите аккаунт заново командой `/jira connect {1}`."},
	{":warning: Your Jira connection has expired. Please manually disconnect and reconnect your account using:\n1. `/jira disconnect %s`\n2. `/jira connect %s`", ":warning: Срок подключения к Jira истёк. Отключите и подключите аккаунт заново:\n1. `/jira disconnect {1}`\n2. `/jira connect {2}`"},
	{"Failed to attach to issue: %s, %s. Please notify your system administrator.\n%s", "Не удалось прикрепить к задаче {1}: {2}. Сообщите системному администратору.\n{3}"},
	{"Disconnected from Jira.", "Аккаунт Jira отключён."},
	{"It is now safe to close this browser window.", "Это окно браузера можно закрыть."},
	{"Mattermost user is now connected to Jira", "Пользователь Mattermost подключён к Jira"},
	{"Mattermost account: %s", "Аккаунт Mattermost: {1}"},
	{"Jira account: %s", "Аккаунт Jira: {1}"},
	{"Disconnect", "Отключить"},

	// Issue actions.
	{"Could not get issue as slack attachment", "Не удалось получить задачу"},
	{"Failed to transition this issue.", "Не удалось перевести задачу."},
	{"No connection could be loaded with given params", "Не удалось найти подключение к Jira"},
	{"Unassigned Jira issue [%s](%s)", "С задачи Jira [{1}]({2}) снят исполнитель"},
	{"`%s` assigned to Jira issue [%s](%s)", "`{1}` назначен(а) исполнителем задачи Jira [{2}]({3})"},
	{"[%s](%s) transitioned to `%s`", "Задача [{1}]({2}) переведена в статус `{3}`"},
	{"We couldn't find the issue key `%s`.  Please confirm the issue key and try again.", "Задача `{1}` не найдена. Проверьте ключ задачи и повторите попытку."},
	{"We couldn't find the issue key `%s`. Please confirm the issue key and try again.", "Задача `{1}` не найдена. Проверьте ключ задачи и повторите попытку."},
	{"You do not have the appropriate permissions to perform this action. Please contact your Jira administrator.", "У вас нет прав на это действие. Обратитесь к администратору Jira."},
	{"`%s` matches %d or more users.  Please specify a unique assignee.\n", "Под `{1}` подходят {2} или более пользователей. Укажите исполнителя точнее.\n"},

	// Slash command replies.
	{rhsDevModeCommandText, "Плагин Jira в режиме разработки и пока вам недоступен."},
	{"Failed to load instances. Error: %v.", "Не удалось загрузить инстансы Jira. Ошибка: {1}."},
	{"Your account is not connected to Jira. Please use `/jira connect` to connect your account.", "Ваш аккаунт не подключён к Jira. Подключите его командой `/jira connect`."},
	{"You do not currently have a Jira account at %s linked to your Mattermost account. Please use `/jira connect` to connect your account.", "К вашему аккаунту Mattermost не привязан аккаунт Jira на {1}. Подключите его командой `/jira connect`."},
	{"Could not complete the **disconnection** request. Error: %v", "Не удалось выполнить **отключение**. Ошибка: {1}"},
	{"Please specify the Jira instance URL", "Укажите адрес инстанса Jira"},
	{"Could not complete the **default instance** request. Error: %v", "Не удалось выбрать **инстанс по умолчанию**. Ошибка: {1}"},
	{"You have successfully set a default instance for your Jira account (**%s**).", "Инстанс по умолчанию для вашего аккаунта Jira выбран (**{1}**)."},
	{"Failed to connect: %s", "Не удалось подключиться: {1}"},
	{"No Jira instances have been installed. Please contact the system administrator.", "Инстансы Jira не установлены. Обратитесь к системному администратору."},
	{"You already have connected all available Jira accounts. Please use `/jira disconnect --instance=%s` to disconnect.", "Все доступные аккаунты Jira уже подключены. Отключить аккаунт можно командой `/jira disconnect --instance={1}`."},
	{"Jira instance %s is not installed, please contact the system administrator.", "Инстанс Jira {1} не установлен, обратитесь к системному администратору."},
	{"You already have a Jira account linked to your Mattermost account from %s. Please use `/jira disconnect --instance=%s` to disconnect.", "К вашему аккаунту Mattermost уже привязан аккаунт Jira с {1}. Отключить его можно командой `/jira disconnect --instance={2}`."},
	{"[Click here to link your Jira account](%s)", "[Нажмите здесь, чтобы привязать аккаунт Jira]({1})"},
	{"`/jira %s` can only be run by a system administrator.", "Команду `/jira {1}` может выполнить только системный администратор."},
	{"`/jira %s` can only be run by a Mattermost system administrator.", "Команду `/jira {1}` может выполнить только системный администратор Mattermost."},
	{"`/jira %s` can only be run by a System Administrator.", "Команду `/jira {1}` может выполнить только системный администратор."},
	{"Please specify both an instance and alias", "Укажите инстанс и псевдоним"},
	{"Alias `%v` is an invalid alias. Please choose an alias without spaces.", "Псевдоним `{1}` недопустим. Выберите псевдоним без пробелов."},
	{"Alias `%v` already exists on InstanceID: %v.", "Псевдоним `{1}` уже используется для инстанса {2}."},
	{"Failed to load instance. Error: %v.", "Не удалось загрузить инстанс. Ошибка: {1}."},
	{"Failed to get instance. InstanceID: %v.", "Не удалось получить инстанс {1}."},
	{"Failed to save instance. Error: %v.", "Не удалось сохранить инстанс. Ошибка: {1}."},
	{"You have successfully aliased instance %v to `%v`.", "Инстансу {1} назначен псевдоним `{2}`."},
	{"Please specify an alias", "Укажите псевдоним"},
	{"Instance with alias `%v` does not exist.", "Инстанса с псевдонимом `{1}` нет."},
	{"You have successfully unaliased instance %v from `%v`.", "Псевдоним `{2}` инстанса {1} удалён."},
	{"Failed to load your connection to Jira. Error: %v.", "Не удалось загрузить ваше подключение к Jira. Ошибка: {1}."},
	{"Your username is not connected to Jira. Please type `jira connect`. Error: %v.", "Ваш пользователь не подключён к Jira. Выполните `/jira connect`. Ошибка: {1}."},
	{"Your username is not connected to Jira. Please type `jira connect`.", "Ваш пользователь не подключён к Jira. Выполните `/jira connect`."},
	{"Current settings:", "Текущие настройки:"},
	{"\t- Notifications for assignee: on ", "\t- Уведомления исполнителю: вкл. "},
	{"\t- Notifications for assignee: off ", "\t- Уведомления исполнителю: выкл. "},
	{"\t- Notifications for mention: on ", "\t- Уведомления об упоминаниях: вкл. "},
	{"\t- Notifications for mention: off ", "\t- Уведомления об упоминаниях: выкл. "},
	{"\t- Notifications for reporter: on ", "\t- Уведомления автору: вкл. "},
	{"\t- Notifications for reporter: off ", "\t- Уведомления автору: выкл. "},
	{"\t- Notifications for watching: on", "\t- Уведомления наблюдателю: вкл."},
	{"\t- Notifications for watching: off", "\t- Уведомления наблюдателю: выкл."},
	{"Please connect to Jira account using the command `/jira connect`", "Подключите аккаунт Jira командой `/jira connect`"},
	{"Unknown setting.", "Неизвестная настройка."},
	{"Please specify an issue key in the form `/jira view <issue-key>`.", "Укажите ключ задачи: `/jira view <ключ-задачи>`."},
	{"Failed to load known Jira instances: %v", "Не удалось загрузить инстансы Jira: {1}"},
	{"(none installed)", "(ничего не установлено)"},
	{"Failed to identify the Jira instance. Error: %v.", "Не удалось определить инстанс Jira. Ошибка: {1}."},
	{"No arguments were expected.", "Команда не принимает аргументы."},
	{"continue in the direct conversation with @jira bot.", "продолжите в личной переписке с ботом @jira."},
	{"Failed to load public key: %v", "Не удалось загрузить открытый ключ: {1}"},
	{"Please specify an issue key in the form `/jira unassign <issue-key>`.", "Укажите ключ задачи: `/jira unassign <ключ-задачи>`."},
	{"Please specify an issue key and an assignee search string, in the form `/jira assign <issue-key> <assignee>`.", "Укажите ключ задачи и исполнителя: `/jira assign <ключ-задачи> <исполнитель>`."},
	{"Failed to identify Jira instance %s. Error: %v.", "Не удалось определить инстанс Jira {1}. Ошибка: {2}."},
	{"Jira is installed, but you are not connected. Please type `/jira connect` to connect.", "Jira установлена, но вы не подключены. Подключитесь командой `/jira connect`."},
	{"No Jira instances installed, please contact your system administrator.", "Инстансы Jira не установлены, обратитесь к системному администратору."},
	{"###### Connected to %v Jira instances:", "###### Подключённых инстансов Jira: {1}"},
	{"There are currently no channels subcriptions to Jira notifications. To add a subscription, navigate to a channel and type `/jira subscribe edit`", "Каналов с подписками на уведомления Jira пока нет. Чтобы добавить подписку, откройте канал и выполните `/jira subscribe edit`"},
	{"The following channels have subscribed to Jira notifications. To modify a subscription, navigate to the channel and type `/jira subscribe edit`", "Эти каналы подписаны на уведомления Jira. Чтобы изменить подписку, откройте канал и выполните `/jira subscribe edit`"},

	// /jira help.
	{"###### Mattermost Jira Plugin - Slash Command Help", "###### Плагин Jira для Mattermost: справка по командам"},
	{"* `/jira connect [jiraURL]` - Connect your Mattermost account to your Jira account", "* `/jira connect [jiraURL]` — подключить аккаунт Jira к аккаунту Mattermost"},
	{"* `/jira disconnect [jiraURL]` - Disconnect your Mattermost account from your Jira account", "* `/jira disconnect [jiraURL]` — отключить аккаунт Jira от аккаунта Mattermost"},
	{"* `/jira [issue] assign [issue-key] [assignee]` - Change the assignee of a Jira issue", "* `/jira [issue] assign [ключ] [исполнитель]` — сменить исполнителя задачи"},
	{"* `/jira [issue] create [text]` - Create a new Issue with 'text' inserted into the description field", "* `/jira [issue] create [текст]` — создать задачу, подставив текст в описание"},
	{"* `/jira [issue] transition [issue-key] [state]` - Change the state of a Jira issue", "* `/jira [issue] transition [ключ] [статус]` — сменить статус задачи"},
	{"* `/jira [issue] unassign [issue-key]` - Unassign the Jira issue", "* `/jira [issue] unassign [ключ]` — снять исполнителя с задачи"},
	{"* `/jira [issue] view [issue-key]` - View the details of a specific Jira issue", "* `/jira [issue] view [ключ]` — показать задачу"},
	{"* `/jira help` - Launch the Jira plugin command line help syntax", "* `/jira help` — показать эту справку"},
	{"* `/jira me` - Display information about the current user", "* `/jira me` — показать сведения о текущем пользователе"},
	{"* `/jira about` - Display build info", "* `/jira about` — показать сведения о сборке"},
	{"* `/jira instance list` - List installed Jira instances", "* `/jira instance list` — показать установленные инстансы Jira"},
	{"* `/jira instance settings [setting] [role] [value]` - Update your user settings", "* `/jira instance settings [настройка] [роль] [значение]` — изменить ваши настройки"},
	{"  * [setting] can be `notifications`", "  * [настройка]: `notifications`"},
	{"  * [role] can be `assignee` , `mention` , `reporter` or `watching`", "  * [роль]: `assignee`, `mention`, `reporter` или `watching`"},
	{"  * [value] can be `on` or `off`", "  * [значение]: `on` или `off`"},
	{"###### For System Administrators:", "###### Для системных администраторов:"},
	{"Setup Jira plugin", "Настройка плагина Jira"},
	{"* `/jira setup` - Start Jira plugin setup flow", "* `/jira setup` — запустить мастер настройки"},
	{"* `/jira webhook [jiraURL]` - Display the webhook URLs to setup on Jira", "* `/jira webhook [jiraURL]` — показать адреса вебхуков для настройки в Jira"},
	{"Install Jira instances:", "Установка инстансов Jira:"},
	{"* `/jira instance install server [jiraURL]` - Connect Mattermost to a Jira Server or Data Center instance located at <jiraURL>", "* `/jira instance install server [jiraURL]` — подключить Jira Server или Data Center по адресу <jiraURL>"},
	{"* `/jira instance install cloud-oauth [jiraURL]` - Connect Mattermost to a Jira Cloud instance using OAuth 2.0 located at <jiraURL>", "* `/jira instance install cloud-oauth [jiraURL]` — подключить Jira Cloud через OAuth 2.0 по адресу <jiraURL>"},
	{"Uninstall Jira instances:", "Удаление инстансов Jira:"},
	{"* `/jira instance uninstall server [jiraURL]` - Disconnect Mattermost from a Jira Server or Data Center instance located at <jiraURL>", "* `/jira instance uninstall server [jiraURL]` — отключить Jira Server или Data Center по адресу <jiraURL>"},
	{"* `/jira instance uninstall cloud-oauth [jiraURL]` - Disconnect Mattermost from a Jira Cloud instance using OAuth 2.0 located at <jiraURL>", "* `/jira instance uninstall cloud-oauth [jiraURL]` — отключить Jira Cloud через OAuth 2.0 по адресу <jiraURL>"},
	{"Manage channel subscriptions:", "Подписки каналов:"},
	{"* `/jira subscribe ` - Configure the Jira notifications sent to this channel", "* `/jira subscribe` — настроить уведомления Jira в этом канале"},
	{"* `/jira subscribe list` - Display all the the subscription rules setup across all the channels and teams on your Mattermost instance", "* `/jira subscribe list` — показать подписки всех каналов и команд сервера"},
	{"Other:", "Другое:"},
	{"* `/jira instance alias [URL] [alias-name]` - assign an alias to an instance", "* `/jira instance alias [URL] [псевдоним]` — назначить инстансу псевдоним"},
	{"* `/jira instance unalias [alias-name]` - remve an alias from an instance", "* `/jira instance unalias [псевдоним]` — удалить псевдоним инстанса"},
	{"* `/jira instance v2 <jiraURL>` - Set the Jira instance to process \"v2\" webhooks and subscriptions (not prefixed with the instance ID)", "* `/jira instance v2 <jiraURL>` — обрабатывать на этом инстансе вебхуки и подписки «v2» (без ID инстанса)"},
	{"* `/jira instance default <jiraURL>` - Set a default instance in case of multiple Jira instances", "* `/jira instance default <jiraURL>` — выбрать инстанс по умолчанию, если их несколько"},
	{"* `/jira webhook [--instance=<jiraURL>]` -  Show the Mattermost webhook to receive JQL queries", "* `/jira webhook [--instance=<jiraURL>]` — показать вебхук Mattermost для JQL-запросов"},
	{"* `/jira v2revert ` - Revert to V2 jira plugin data model", "* `/jira v2revert` — вернуться к модели данных плагина V2"},

	// Hints of the /jira command.
	{"Connect to and interact with Jira", "Подключение к Jira и работа с задачами"},
	{"Display help for `/jira` command", "Показать справку по команде `/jira`"},
	{"Display information about the current user", "Показать сведения о текущем пользователе"},
	{"View and manage installed Jira instances; more commands available to system administrators", "Инстансы Jira; у системных администраторов больше команд"},
	{"Connect Mattermost to a Jira instance", "Подключить Mattermost к инстансу Jira"},
	{"Disconnect Mattermost from a Jira instance", "Отключить Mattermost от инстанса Jira"},
	{"List installed Jira instances", "Показать установленные инстансы Jira"},
	{"View and manage Jira issues", "Просмотр задач Jira и работа с ними"},
	{"Create a new Jira issue and optionally prefill its description", "Создать задачу Jira, при желании заполнив описание"},
	{"Optional text inserted into the Jira issue description", "Необязательный текст для описания задачи"},
	{"Connect your Mattermost account to your Jira account", "Подключить аккаунт Jira к аккаунту Mattermost"},
	{"Create an alias to your Jira instance", "Назначить инстансу Jira псевдоним"},
	{"Remove an alias from a Jira instance", "Удалить псевдоним инстанса Jira"},
	{"Disconnect your Mattermost account from your Jira account", "Отключить аккаунт Jira от аккаунта Mattermost"},
	{"Set a default instance in case of multiple Jira instances", "Выбрать инстанс по умолчанию, если их несколько"},
	{"View or update your user settings", "Посмотреть или изменить ваши настройки"},
	{"View your current settings", "Показать текущие настройки"},
	{"Turn notifications on", "Включить уведомления"},
	{"Turn notifications off", "Выключить уведомления"},
	{"Display a Jira issue", "Показать задачу Jira"},
	{"Change the state of a Jira issue", "Сменить статус задачи Jira"},
	{"Change the assignee of a Jira issue", "Сменить исполнителя задачи Jira"},
	{"Unassign a Jira issue", "Снять исполнителя с задачи Jira"},
	{"List or configure the Jira notifications sent to this channel", "Показать или настроить уведомления Jira в этом канале"},
	{"Configure the Jira notifications sent to this channel", "Настроить уведомления Jira в этом канале"},
	{"List the Jira notifications sent to this channel", "Показать уведомления Jira в этом канале"},
	{"Display the webhook URLs to set up on Jira", "Показать адреса вебхуков для настройки в Jira"},
	{"Start Jira plugin setup flow", "Запустить мастер настройки плагина Jira"},
}
