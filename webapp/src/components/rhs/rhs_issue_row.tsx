// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHSIssue} from 'types/rhs';
import {isRHSIssueOverdue} from 'utils/rhs_group';
import {formatRHSRelativeTime, formatRHSShortDate} from 'utils/rhs_time';

import {rhsInitials} from './rhs_avatar';
import RHSIssueTypeIcon from './rhs_issue_type_icon';
import {RHS_STRINGS} from './rhs_strings';

export function rhsStatusClass(categoryKey: string): string {
    switch (categoryKey) {
    case 'new':
    case 'indeterminate':
    case 'done':
    case 'undefined':
        return 'jira-rhs-status jira-rhs-status--' + categoryKey;
    default:
        return 'jira-rhs-status jira-rhs-status--default';
    }
}

export type Props = {
    issue: RHSIssue;
    nowMs: number;

    // Opens the card in the panel. Modified clicks (new tab, middle button)
    // still follow the link to Jira.
    onOpen?: (key: string) => void;
};

function issueMeta(issue: RHSIssue, nowMs: number): {text: string; overdue: boolean} {
    if (issue.dueDate) {
        const dueMs = Date.parse(issue.dueDate + 'T12:00:00Z');
        if (!Number.isNaN(dueMs)) {
            const overdue = isRHSIssueOverdue(issue, nowMs);
            const text = RHS_STRINGS.duePrefix + ' ' + formatRHSShortDate(dueMs, nowMs) + (overdue ? ', ' + RHS_STRINGS.overdue : '');
            return {text, overdue};
        }
    }
    const updated = formatRHSRelativeTime(issue.updated, nowMs);
    return {text: updated ? RHS_STRINGS.updatedPrefix + ' ' + updated : '', overdue: false};
}

// rhsRowTitle is the tooltip of a compact row: what the row has no room for.
export function rhsRowTitle(issue: RHSIssue, nowMs: number): string {
    const meta = issueMeta(issue, nowMs);
    const lines = [issue.key + ' · ' + issue.summary];
    const details = [RHS_STRINGS.rowStatus.replace('{status}', issue.status?.name || '')];
    if (meta.text) {
        details.push(meta.text);
    }
    if (issue.assigneeName) {
        details.push(RHS_STRINGS.fieldAssignee + ': ' + issue.assigneeName);
    }
    lines.push(details.join(' · '));
    return lines.join('\n');
}

export function RHSPriorityIcon(props: {issue: RHSIssue}): JSX.Element {
    const {issue} = props;
    if (!issue.priority) {
        return <span className='jira-rhs-row-priority'/>;
    }
    return (
        <span
            className='jira-rhs-row-priority'
            title={issue.priority}
        >
            {issue.priorityIconUrl ? (
                <img
                    src={issue.priorityIconUrl}
                    alt={issue.priority}
                    width={14}
                    height={14}
                />
            ) : issue.priority.slice(0, 1)}
        </span>
    );
}

export function RHSRowAvatar(props: {name?: string}): JSX.Element {
    if (!props.name) {
        return (
            <span
                className='jira-rhs-mini-avatar jira-rhs-mini-avatar--empty'
                title={RHS_STRINGS.unassigned}
            />
        );
    }
    return (
        <span
            className='jira-rhs-mini-avatar'
            title={props.name}
        >
            {rhsInitials(props.name)}
        </span>
    );
}

// RHSIssueRow is one line of the compact list (design 4в): type, key,
// summary, priority and assignee. Status, dates and the full summary are in
// the tooltip and the card.
export default function RHSIssueRow(props: Props): JSX.Element {
    const issue = props.issue;
    const overdue = isRHSIssueOverdue(issue, props.nowMs);
    const done = issue.status?.categoryKey === 'done';
    return (
        <a
            className={'jira-rhs-row' + (done ? ' jira-rhs-row--done' : '')}
            data-testid={'rhs-issue-' + issue.key}
            href={issue.browseUrl}
            target='_blank'
            rel='noopener noreferrer'
            title={rhsRowTitle(issue, props.nowMs)}
            onClick={(event) => {
                if (!props.onOpen || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
                    return;
                }
                event.preventDefault();
                props.onOpen(issue.key);
            }}
        >
            <RHSIssueTypeIcon
                issueType={issue.issueType}
                iconUrl={issue.issueTypeIconUrl}
            />
            <span className='jira-rhs-row-key'>{issue.key}</span>
            <span className='jira-rhs-row-summary'>{issue.summary}</span>
            {overdue ? (
                <span
                    className='jira-rhs-row-overdue'
                    data-testid={'rhs-overdue-' + issue.key}
                >
                    {RHS_STRINGS.overdue}
                </span>
            ) : <span/>}
            <RHSPriorityIcon issue={issue}/>
            <RHSRowAvatar name={issue.assigneeName}/>
        </a>
    );
}
