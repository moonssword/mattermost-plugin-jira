// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatRHSShortDate} from 'utils/rhs_time';
import {RHSChannelSubscription} from 'types/rhs_channel';

import {RHS_STRINGS} from '../../rhs_strings';

const EVENT_LABELS: {[event: string]: string} = {
    event_created: 'создана',
    event_deleted: 'удалена',
    event_deleted_unresolved: 'удалена нерешённой',
    event_updated_reopened: 'переоткрыта',
    event_updated_resolved: 'решена',
    event_created_comment: 'новый комментарий',
    event_updated_comment: 'комментарий изменён',
    event_deleted_comment: 'комментарий удалён',
    event_updated_any: 'любое изменение',
    event_updated_assignee: 'исполнитель изменён',
    event_updated_status: 'статус изменён',
    event_updated_priority: 'приоритет изменён',
    event_updated_summary: 'тема изменена',
    event_updated_description: 'описание изменено',
    event_updated_labels: 'метки изменены',
    event_updated_sprint: 'спринт изменён',
    event_updated_fix_version: 'версия исправления изменена',
    event_updated_affects_version: 'затронутая версия изменена',
    event_updated_attachment: 'вложение изменено',
    event_updated_components: 'компоненты изменены',
    event_updated_issue_type: 'тип изменён',
    event_updated_rank: 'ранг изменён',
    event_updated_reporter: 'автор изменён',
};

export function rhsEventLabel(event: string): string {
    if (EVENT_LABELS[event]) {
        return EVENT_LABELS[event];
    }
    if (event.startsWith('event_updated_')) {
        return 'изменено поле ' + event.slice('event_updated_'.length);
    }
    return event;
}

// subscriptionScope renders "Проект BACK · типов задач: 2 · фильтров: 1".
export function subscriptionScope(sub: RHSChannelSubscription): string {
    const parts: string[] = [];
    const projects = sub.filters.projects || [];
    if (projects.length) {
        parts.push(RHS_STRINGS.channelProject + ' ' + projects.join(', '));
    }
    const types = sub.filters.issue_types || [];
    if (types.length) {
        parts.push(RHS_STRINGS.channelIssueTypes.replace('{n}', String(types.length)));
    }
    const fields = sub.filters.fields || [];
    if (fields.length) {
        parts.push(RHS_STRINGS.channelFields.replace('{n}', String(fields.length)));
    }
    return parts.join(' · ');
}

export function subscriptionEvents(sub: RHSChannelSubscription): string {
    const events = sub.filters.events || [];
    const list = events.length ? events.map(rhsEventLabel).join(', ') : RHS_STRINGS.channelAllEvents;
    return RHS_STRINGS.channelEvents.replace('{list}', list);
}

export function subscriptionPausedLine(sub: RHSChannelSubscription, nowMs: number): string {
    const date = sub.paused_at ? formatRHSShortDate(sub.paused_at, nowMs) : '';
    const line = RHS_STRINGS.channelPaused.replace('{date}', date).trim();
    return sub.paused_by_name ? line + ' · ' + sub.paused_by_name : line;
}
