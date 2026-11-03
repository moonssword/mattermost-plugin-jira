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
};
