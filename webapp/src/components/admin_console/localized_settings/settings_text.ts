// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mattermost shows the labels of a plugin manifest in one language only, so
// the System Console page of the plugin renders them from here, in the
// language of the user. Everything but Russian falls back to English.
export type SettingLanguage = 'ru' | 'en';

export type SettingKind = 'bool' | 'text' | 'longtext' | 'number' | 'radio' | 'generated' | 'secret';

export type LocalizedText = {[language in SettingLanguage]: string};

export type SettingOption = {
    value: string;
    label: LocalizedText;
};

export type SettingDescriptor = {
    key: string;
    kind: SettingKind;
    label: LocalizedText;

    // Inline markup: **bold** and [text](url).
    help: LocalizedText;
    regenerateHelp?: LocalizedText;
    placeholder?: string;
    options?: SettingOption[];

    // Mattermost applies the manifest default only to its own setting types.
    defaultValue?: boolean | string | number;
};

export function settingLanguage(locale: string | undefined): SettingLanguage {
    return (locale || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const COMMON_TEXT = {
    yes: {ru: 'Да', en: 'True'},
    no: {ru: 'Нет', en: 'False'},
    regenerate: {ru: 'Создать новый', en: 'Regenerate'},
    setByEnv: {
        ru: 'Настройка задана переменной окружения и здесь не меняется.',
        en: 'This setting has been set through an environment variable. It cannot be changed here.',
    },
};

export const ADMIN_TEXT = {
    title: {ru: 'Подключение к Jira', en: 'Jira connection'},
    docs: {
        ru: 'Подробности: [настройка плагина](https://mattermost.com/pl/integrate/jira-admin-setup) и [вебхуки](https://mattermost.com/pl/integrate/configure-webhooks-in-jira).',
        en: 'See [plugin setup](https://mattermost.com/pl/integrate/jira-admin-setup) and [webhooks](https://mattermost.com/pl/integrate/configure-webhooks-in-jira).',
    },
    instances: {ru: 'Инстансы Jira', en: 'Jira instances'},
    instancesHelp: {
        ru: 'Подключить или отключить инстанс можно командами `/jira instance` или мастером настройки.',
        en: 'Install or uninstall an instance with the `/jira instance` commands or the setup wizard.',
    },
    noInstances: {ru: 'Нет подключённых инстансов.', en: 'No instances are installed.'},
    webhook: {ru: 'Вебхук', en: 'Webhook'},
    webhookHelp: {
        ru: 'Адрес для вебхука в Jira. Содержит секрет, не публикуйте его. Копируется полностью.',
        en: 'The URL for the webhook in Jira. It contains the secret, do not publish it. The full URL is copied.',
    },
    copy: {ru: 'Копировать', en: 'Copy'},
    copied: {ru: 'Скопировано', en: 'Copied'},
    wizard: {ru: 'Мастер настройки', en: 'Setup wizard'},
    wizardHelp: {
        ru: 'Подключение нового инстанса по шагам в личных сообщениях с ботом Jira.',
        en: 'Install a new instance step by step in a direct message with the Jira bot.',
    },
    wizardRun: {ru: 'Запустить', en: 'Start'},
    wizardStarted: {ru: 'Мастер запущен, продолжите в чате с ботом Jira.', en: 'The wizard started, continue in the direct message with the Jira bot.'},
    wizardFailed: {ru: 'Не удалось запустить мастер.', en: 'Failed to start the wizard.'},
    loadFailed: {ru: 'Не удалось загрузить данные плагина.', en: 'Failed to load the plugin data.'},
    version: {ru: 'Версия плагина', en: 'Plugin version'},
    connectedUsers: {ru: 'Подключённые пользователи', en: 'Connected users'},
    connectedUsersHelp: {
        ru: 'Пользователи Mattermost, подключившие свой аккаунт Jira хотя бы к одному инстансу. Отключившиеся не считаются.',
        en: 'Mattermost users who connected their Jira account to at least one instance. Those who disconnected are not counted.',
    },
    connectedShort: {ru: 'подключено:', en: 'connected:'},
    dataCenter: {ru: 'Data Center', en: 'Data Center'},
    cloud: {ru: 'Cloud', en: 'Cloud'},
};

export const LOCALIZED_SETTINGS: SettingDescriptor[] = [
    {
        key: 'EnableJiraUI',
        defaultValue: true,
        kind: 'bool',
        label: {
            ru: 'Разрешить создавать и прикладывать задачи Jira в Mattermost:',
            en: 'Allow users to attach and create Jira issues in Mattermost:',
        },
        help: {
            ru: 'При **Нет** пользователи не могут создавать задачи и прикладывать к ним сообщения. На уведомления из вебхуков это не влияет. Чтобы сбросить состояние плагина у всех пользователей, выберите **Нет**, затем выключите и снова включите плагин в разделе **Системная консоль > Плагины > Управление плагинами**.\n\nПри **Да** подключите плагин к Jira командой `/jira install`. [Подробнее в документации](https://about.mattermost.com/default-jira-plugin-link-application).',
            en: 'When **false**, users cannot attach and create Jira issues in Mattermost. Does not affect Jira webhook notifications. Select **false** then disable and re-enable this plugin in **System Console > Plugins > Plugin Management** to reset the plugin state for all users.\n\nWhen **true**, install this plugin to your Jira instance with `/jira install` to allow users to create and manage issues across Mattermost channels. See [documentation](https://about.mattermost.com/default-jira-plugin-link-application) to learn more.',
        },
    },
    {
        key: 'EnableJiraRHS',
        defaultValue: false,
        kind: 'bool',
        label: {
            ru: 'Показывать задачи Jira в правой боковой панели:',
            en: 'Show Jira tickets in the right-hand sidebar:',
        },
        help: {
            ru: 'При **Нет** панель не регистрируется. При **Да** пользователи с подключённым аккаунтом Jira (Cloud или Server/Data Center) открывают её значком на панели приложений.',
            en: 'When **false**, the Jira tickets right-hand sidebar is not registered. When **true**, users with a connected Jira account (Cloud or Server/Data Center) can open their tickets from the App Bar.',
        },
    },
    {
        key: 'RHSDevMode',
        defaultValue: false,
        kind: 'bool',
        label: {
            ru: 'Режим разработки:',
            en: 'Development mode:',
        },
        help: {
            ru: 'Плагин доступен только пользователям из списка ниже: остальные не видят кнопок и панели, а команды `/jira` и методы плагина им отказывают. Личные сообщения бота приходят только пользователям из списка. Посты подписок видны всем участникам канала, поэтому проверяйте в отдельном канале. После изменения пользователям нужно обновить страницу.',
            en: 'The plugin is available only to the users listed below: others do not see its buttons and panel, and the `/jira` commands and the plugin routes refuse them. Bot direct messages go only to the listed users. Subscription posts are seen by everyone in the channel, so test in a separate channel. Users need to reload the page after a change.',
        },
    },
    {
        key: 'RHSAllowedUsers',
        kind: 'longtext',
        label: {
            ru: 'Пользователи режима разработки:',
            en: 'Development mode users:',
        },
        help: {
            ru: 'Логины Mattermost через запятую или с новой строки. Пустой список: в режиме разработки плагин недоступен никому. Системные администраторы в список автоматически не входят, но настройки плагина в Системной консоли им доступны всегда.',
            en: 'Mattermost logins separated by commas or lines. An empty list means that in development mode the plugin is available to nobody. System administrators are not included automatically, but the plugin settings in the System Console always stay available to them.',
        },
        placeholder: 'anna, boris',
    },
    {
        key: 'RHSDefaultStyle',
        defaultValue: 'compact',
        kind: 'radio',
        label: {
            ru: 'Стиль правой панели по умолчанию:',
            en: 'Default style of the right-hand sidebar:',
        },
        help: {
            ru: 'Для пользователей, которые не выбрали стиль сами в настройках панели. В компактном видно больше задач, в карточках просторнее. Цвета берутся из темы Mattermost.',
            en: 'For users who did not choose a style in the panel settings. Compact shows more issues, Cards is roomier. Colors come from the Mattermost theme.',
        },
        options: [
            {value: 'compact', label: {ru: 'Компактный', en: 'Compact'}},
            {value: 'cards', label: {ru: 'Карточки', en: 'Cards'}},
        ],
    },
    {
        key: 'secret',
        kind: 'generated',
        label: {ru: 'Секрет вебхука:', en: 'Webhook Secret:'},
        help: {
            ru: 'Секрет, которым вебхук подтверждает запросы к Mattermost.',
            en: 'The secret used to authenticate the webhook to Mattermost.',
        },
        regenerateHelp: {
            ru: 'Создаёт новый секрет для адреса вебхука. После этого существующий вебхук в Jira перестанет работать, его адрес нужно будет обновить.',
            en: 'Regenerates the secret for the webhook URL endpoint. Regenerating the secret invalidates your existing Jira integrations.',
        },
    },
    {
        key: 'RolesAllowedToEditJiraSubscriptions',
        defaultValue: 'system_admin',
        kind: 'radio',
        label: {
            ru: 'Роли Mattermost, которым можно менять подписки Jira:',
            en: 'Mattermost Roles Allowed to Edit Jira Subscriptions:',
        },
        help: {
            ru: 'Кто может подписывать каналы на задачи Jira.',
            en: 'Mattermost users who can subscribe channels to Jira tickets.',
        },
        options: [
            {value: 'users', label: {ru: 'Все пользователи', en: 'All users'}},
            {value: 'channel_admin', label: {ru: 'Кто может менять настройки канала', en: 'Users who can manage channel settings'}},
            {value: 'team_admin', label: {ru: 'Кто может управлять командами', en: 'Users who can manage teams'}},
            {value: 'system_admin', label: {ru: 'Системные администраторы', en: 'System Admins'}},
        ],
    },
    {
        key: 'GroupsAllowedToEditJiraSubscriptions',
        kind: 'text',
        label: {
            ru: 'Группы Jira, которым можно менять подписки:',
            en: 'Jira Groups Allowed to Edit Jira Subscriptions:',
        },
        help: {
            ru: 'Названия групп через запятую. Если не указаны, подписку может создать любой пользователь Jira. Работает только для старых подключений, установленных на версии плагина 2.4 или раньше.',
            en: 'Comma separated list of Group Names. List the Jira user groups who can create subscriptions. If none are specified, any Jira user can create a subscription. Jira groups restrictions are only applicable for a legacy instance installed on Jira 2.4 or earlier.',
        },
    },
    {
        key: 'SecurityLevelEmptyForJiraSubscriptions',
        defaultValue: true,
        kind: 'bool',
        label: {
            ru: 'По умолчанию подписки без уровня безопасности:',
            en: 'Default Subscription Security Level to Empty:',
        },
        help: {
            ru: 'Задачи с уровнем безопасности попадут в подписку, только если этот уровень указан в её фильтре.',
            en: 'Subscriptions will only include issues that have a security level assigned if the appropriate security level has been included as a filter',
        },
    },
    {
        key: 'JiraAdminAdditionalHelpText',
        kind: 'text',
        label: {
            ru: 'Дополнительный текст справки Jira:',
            en: 'Additional Help Text to be shown with Jira Help:',
        },
        help: {
            ru: 'Показывается пользователю вместе с ответом команды `/jira help`.',
            en: "Additional Help Text to be shown to the user along with the output of '/jira help' command.",
        },
    },
    {
        key: 'HideDecriptionComment',
        defaultValue: false,
        kind: 'bool',
        label: {
            ru: 'Скрывать описания задач и комментарии:',
            en: 'Hide issue descriptions and comments:',
        },
        help: {
            ru: 'Не показывать описания и комментарии в сообщениях подписок и вебхуков.',
            en: 'Hide detailed issue descriptions and comments from Subscription and Webhook messages',
        },
    },
    {
        key: 'EnableAutocomplete',
        defaultValue: true,
        kind: 'bool',
        label: {
            ru: 'Включить автодополнение команд:',
            en: 'Enable slash command autocomplete:',
        },
        help: {
            ru: 'Автодополнение подсказывает пользователям доступные команды `/jira`.',
            en: "Autocomplete guides users through the available '/jira' slash commands.",
        },
    },
    {
        key: 'DisplaySubscriptionNameInNotifications',
        defaultValue: false,
        kind: 'bool',
        label: {
            ru: 'Показывать название подписки в уведомлениях:',
            en: 'Display subscription name in notifications:',
        },
        help: {
            ru: 'Добавлять название подписки в сообщение, которое подписка публикует в канал.',
            en: 'Display subscription name in post when a subscription posts to a channel',
        },
    },
    {
        key: 'EncryptionKey',
        kind: 'generated',
        label: {ru: 'Ключ шифрования данных:', en: 'At Rest Encryption Key:'},
        help: {
            ru: 'Ключ, которым шифруются сохранённые токены API.',
            en: 'The encryption key used to encrypt stored API tokens.',
        },
        regenerateHelp: {
            ru: 'Создаёт новый ключ. Токены, зашифрованные старым ключом, перестанут читаться, и пользователям придётся подключиться заново.',
            en: 'Regenerates the encryption key. Tokens encrypted with the old key can no longer be read, so users will have to connect again.',
        },
    },
    {
        key: 'AdminAPIToken',
        kind: 'secret',
        label: {ru: 'API-токен администратора:', en: 'Admin API Token'},
        help: {
            ru: 'Токен нужен, чтобы получать уведомления о комментариях и новых задачах, когда их автор не подключён к Jira, и для настройки автоссылок.\n**Важно:** токен должен принадлежать администратору Jira, иначе уведомления по недоступным ему проектам не придут и автоссылки работать не будут.\n• **Jira Cloud:** [API-токен](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) вместе с почтой администратора ниже.\n• **Jira Server / Data Center:** [персональный токен доступа](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) (Personal Access Token). Почта администратора не нужна.',
            en: 'Set this to get notified for comment and issue created events when the user triggering the event is not connected to Jira. This is also used for setting up autolink in the plugin.\n**Note:** This token should belong to an admin Jira account. Otherwise, the notification will not be delivered for projects that the user cannot access and autolink will not work.\n• **Jira Cloud:** use an [API token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) together with Admin Email below.\n• **Jira Server/Data Center:** use a [Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html). Admin Email is not required.',
        },
    },
    {
        key: 'AdminEmail',
        kind: 'text',
        label: {ru: 'Почта администратора:', en: 'Admin Email'},
        help: {
            ru: '**Важно:** нужна только для Jira Cloud: для автоссылок и для уведомлений о комментариях и новых задачах, когда их автор не подключён к Jira. Для Jira Server / Data Center не используется, там достаточно токена администратора.',
            en: '**Note:** Required for Jira Cloud to set up autolink and to get notified for comment and issue created events when the user triggering the event is not connected to Jira. Not used for Jira Server/Data Center, which authenticates with the Admin API Token alone.',
        },
    },
    {
        key: 'ThreadedJiraCommentSubscriptionDuration',
        defaultValue: 30,
        kind: 'number',
        label: {ru: 'Срок публикации комментариев Jira в тред:', en: 'Threaded Jira Comment Subscription Duration'},
        help: {
            ru: 'Сколько дней комментарии Jira публикуются ответами в тред, а не новыми сообщениями.',
            en: 'Number of days Jira comments will be posted as threaded replies instead of a new post',
        },
        placeholder: '30',
    },
    {
        key: 'TeamIDs',
        kind: 'text',
        label: {ru: 'Список команд:', en: 'Team List'},
        help: {
            ru: 'Названия и идентификаторы команд через запятую, по ним фильтруются подписки.\n**Важно:** эти команды действуют для всех подключённых инстансов Jira.',
            en: 'Comma separated list of team name and IDs to be used for filtering subscriptions\n**Note:** Teams provided here will be used across all configured Jira instances',
        },
        placeholder: '[team-1-name](team-1-id),[team-2-name](team-2-id)',
    },
];
