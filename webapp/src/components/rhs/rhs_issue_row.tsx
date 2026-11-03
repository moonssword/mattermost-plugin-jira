// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHSIssue} from 'types/rhs';
import {isRHSIssueOverdue} from 'utils/rhs_group';
import {formatRHSRelativeTime, formatRHSShortDate} from 'utils/rhs_time';

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

export default function RHSIssueRow(props: Props): JSX.Element {
    const issue = props.issue;
    const meta = issueMeta(issue, props.nowMs);
    return (
        <article
            className='jira-rhs-issue'
            data-testid={'rhs-issue-' + issue.key}
        >
            <a
                className='jira-rhs-issue-link'
                href={issue.browseUrl}
                target='_blank'
                rel='noopener noreferrer'
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
                <div className='jira-rhs-issue-main'>
                    <div className='jira-rhs-issue-line1'>
                        <span className='jira-rhs-issue-key'>{issue.key}</span>
                        <span className={rhsStatusClass(issue.status.categoryKey)}>
                            {issue.status.name}
                        </span>
                        {issue.priority && (
                            <span
                                className='jira-rhs-issue-priority'
                                title={issue.priority}
                            >
                                {issue.priorityIconUrl ? (
                                    <img
                                        src={issue.priorityIconUrl}
                                        alt={issue.priority}
                                        width={14}
                                        height={14}
                                    />
                                ) : issue.priority}
                            </span>
                        )}
                    </div>
                    <span
                        className='jira-rhs-issue-summary'
                        title={issue.summary}
                    >
                        {issue.summary}
                    </span>
                    <div className='jira-rhs-issue-line2'>
                        {meta.text && (
                            <span className={meta.overdue ? 'jira-rhs-issue-time jira-rhs-issue-time--overdue' : 'jira-rhs-issue-time'}>
                                {meta.text}
                            </span>
                        )}
                        {meta.text && <span className='jira-rhs-issue-dot'>{'·'}</span>}
                        <span className='jira-rhs-issue-project'>{issue.project}</span>
                    </div>
                </div>
            </a>
        </article>
    );
}
