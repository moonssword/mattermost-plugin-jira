// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ReactSelectOption} from 'types/model';
import {tr} from 'utils/i18n';

export function getJiraEventOptions(): ReactSelectOption[] {
    return [
        {value: 'event_created', label: tr('Задача создана')},
        {value: 'event_deleted', label: tr('Задача удалена')},
        {value: 'event_deleted_unresolved', label: tr('Удалена нерешённая задача')},
        {value: 'event_updated_reopened', label: tr('Задача переоткрыта')},
        {value: 'event_updated_resolved', label: tr('Задача решена')},
        {value: 'event_created_comment', label: tr('Новый комментарий')},
        {value: 'event_updated_comment', label: tr('Комментарий изменён')},
        {value: 'event_deleted_comment', label: tr('Комментарий удалён')},
        {value: 'event_updated_any', label: tr('Изменено: любое поле')},
        {value: 'event_updated_affects_version', label: tr('Изменено: затронутая версия')},
        {value: 'event_updated_assignee', label: tr('Изменено: исполнитель')},
        {value: 'event_updated_attachment', label: tr('Изменено: вложение')},
        {value: 'event_updated_description', label: tr('Изменено: описание')},
        {value: 'event_updated_fix_version', label: tr('Изменено: версия исправления')},
        {value: 'event_updated_issue_type', label: tr('Изменено: тип задачи')},
        {value: 'event_updated_labels', label: tr('Изменено: метки')},
        {value: 'event_updated_priority', label: tr('Изменено: приоритет')},
        {value: 'event_updated_rank', label: tr('Изменено: ранг')},
        {value: 'event_updated_reporter', label: tr('Изменено: автор')},
        {value: 'event_updated_sprint', label: tr('Изменено: спринт')},
        {value: 'event_updated_status', label: tr('Изменено: статус')},
        {value: 'event_updated_summary', label: tr('Изменено: тема')},
        {value: 'event_updated_components', label: tr('Изменено: компоненты')},
    ];
}
