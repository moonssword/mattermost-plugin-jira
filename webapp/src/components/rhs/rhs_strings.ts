// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// All user-facing text of the Jira RHS. Keep it here so wording stays
// consistent and can be moved to i18n later.
export const RHS_STRINGS = {
    title: 'Jira',
    openPanel: 'Открыть панель Jira',

    // Sections
    sectionMyIssues: 'Мои задачи',
    sectionChannel: 'Канал',
    sectionCreate: 'Создать',
    sectionsLabel: 'Разделы панели Jira',

    // Instance
    instanceLabel: 'Инстанс Jira',
    instanceCloud: 'Cloud',
    instanceServer: 'Data Center',

    // Issue list
    empty: 'В этой вкладке нет задач',
    error: 'Не удалось загрузить задачи',
    retry: 'Повторить',
    rateLimited: 'Jira ограничивает частоту запросов, попробуйте чуть позже',
    refresh: 'Обновить',
    newTicket: 'Новая задача',
    loadMore: 'Показать ещё',
    loadingMore: 'Загрузка…',
    sortLabel: 'Сортировка',
    sortUpdated: 'По обновлению',
    sortCreated: 'По созданию',
    assignedTab: 'Назначены мне',

    // Quick filters and search
    filtersLabel: 'Быстрые фильтры',
    filterAssigned: 'Назначены мне',
    filterReported: 'Я автор',
    filterWatching: 'Слежу',
    filterSprint: 'Текущий спринт',
    searchPlaceholder: 'Поиск по ключу, теме или JQL',
    searchLabel: 'Поиск задач',
    searchClear: 'Очистить поиск',
    found: 'Найдено',
    emptyFilter: 'Нет задач по этому фильтру',
    emptySearch: 'Ничего не найдено',
    queryRejected: 'Jira не приняла запрос',

    // Groups by status category
    groupInProgress: 'В работе',
    groupToDo: 'К выполнению',
    groupDone: 'Готово',
    groupOther: 'Без категории',

    // Issue row
    updatedPrefix: 'Обновлено',
    duePrefix: 'Срок:',
    overdue: 'просрочено',

    // Issue card
    back: 'Назад к списку',
    openInJira: 'Открыть в Jira',
    shareToChannel: 'Поделиться в канал',
    shared: 'Задача отправлена в канал',
    assignToMe: 'Назначить на меня',
    unassigned: 'Не назначено',
    transitions: 'Переходы',
    noTransitions: 'Нет доступных переходов',
    changeStatus: 'Сменить статус',
    fieldAssignee: 'Исполнитель',
    fieldReporter: 'Автор',
    fieldPriority: 'Приоритет',
    fieldDue: 'Срок',
    fieldLabels: 'Метки',
    fieldCreated: 'Создана',
    fieldUpdated: 'Обновлена',
    description: 'Описание',
    noDescription: 'Описания нет',
    changeAssignee: 'Изменить исполнителя',
    assigneeSearch: 'Поиск пользователя Jira',
    assigneeNoResults: 'Никого не нашли',
    assigneeTypeHint: 'Начните вводить имя или логин',
    cancel: 'Отмена',
    comments: 'Комментарии',
    commentsOlder: 'Показаны последние {shown} из {total}. Остальные — в Jira.',
    noComments: 'Комментариев пока нет',
    commentPlaceholder: 'Комментарий…',
    commentHint: 'Уйдёт в Jira от вашего имени · Ctrl+Enter',
    send: 'Отправить',
    cardNotFound: 'Задача не найдена или у вас нет к ней доступа',
    cardForbidden: 'Jira не разрешает это действие для вашей учётной записи',
    cardActionFailed: 'Jira не выполнила действие',

    // Connect screen
    connectTitle: 'Подключите Jira',
    connectText: 'Чтобы видеть свои задачи, создавать и менять их из Mattermost, свяжите аккаунт. Вход происходит на сайте Jira.',
    connect: 'Подключить аккаунт Jira',
    connectHint: 'Плагин получит доступ к задачам от вашего имени. Отключить можно в настройках.',
    connectWaiting: 'Завершите вход в открывшейся вкладке. Панель обновится сама.',
    notConnected: 'Подключите аккаунт Jira, чтобы видеть свои задачи',

    // No instance screen
    noInstanceTitle: 'Jira ещё не подключена',
    noInstanceUser: 'Попросите администратора подключить Jira к Mattermost.',
    noInstanceAdmin: 'Подключите инстанс Jira Cloud или Data Center с помощью мастера настройки.',
    runSetup: 'Запустить мастер настройки',
    setupStarted: 'Мастер настройки продолжится в личных сообщениях с ботом @jira.',
    setupFailed: 'Не удалось запустить мастер настройки. Выполните /jira setup вручную.',

    // Channel section
    channelTitle: 'Подписки канала на события Jira',
    channelText: 'Настройте, какие события Jira публиковать в этом канале.',
    channelOpen: 'Открыть подписки канала',
    channelNoChannel: 'Откройте канал, чтобы настроить его подписки.',

    // Create section
    createTitle: 'Новая задача Jira',
    createText: 'Создайте задачу в Jira. Ссылка на неё появится в текущем канале.',
    createOpen: 'Создать задачу',
    createProject: 'Проект',
    createIssueType: 'Тип',
    createLoadingProjects: 'Загружаем проекты…',
    createNoProjects: 'Нет проектов, в которых вы можете создавать задачи',
    createReplyInThread: 'Ответить в треде ссылкой на задачу',
    createSubmit: 'Создать задачу',
    createCreating: 'Создаём…',
    createDone: 'Задача {key} создана',
    createOpenCard: 'Открыть карточку',
    createAnother: 'Создать ещё',
    createPostToChannel: 'Написать в канал о новой задаче',
    createUnsupportedFields: 'Обязательные поля этого типа нельзя заполнить в Mattermost: {fields}. Создайте задачу в Jira.',
    createFrom: 'Из сообщения',

    // Attach a message to an issue
    attachTitle: 'Приложить к задаче',
    attachSearch: 'Ключ, тема или JQL',
    attachMine: 'Мои открытые задачи',
    attachSubmit: 'Приложить к {key}',
    attachChoose: 'Выберите задачу',
    attachSending: 'Прикладываем…',
    attachDone: 'Сообщение приложено к {key}',
    attachDoneHint: 'Комментарий добавлен в Jira, в треде появился ответ со ссылкой на задачу.',
    attachClose: 'Готово',
    attachPostMissing: 'Сообщение не найдено. Откройте его в канале и попробуйте ещё раз.',
};
