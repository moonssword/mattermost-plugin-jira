// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {RHSErrorCode, RHSIssue} from 'types/rhs';

import {RHSGroupKey, groupRHSIssues} from 'utils/rhs_group';

import RHSIssueRow from './rhs_issue_row';
import {RHS_STRINGS} from './rhs_strings';

const groupTitles: Record<RHSGroupKey, string> = {
    indeterminate: RHS_STRINGS.groupInProgress,
    new: RHS_STRINGS.groupToDo,
    done: RHS_STRINGS.groupDone,
    other: RHS_STRINGS.groupOther,
};

export type Props = {
    issues: RHSIssue[];
    loading: boolean;
    isLast: boolean;
    error: RHSErrorCode | null;
    onLoadMore: () => void;
    onRetry: () => void;
    onOpenIssue?: (key: string) => void;
};

export default function RHSIssueList(props: Props): JSX.Element {
    const [nowMs] = useState(() => Date.now());

    return (
        <div
            className='jira-rhs-list'
            data-testid='rhs-issue-list'
        >
            {groupRHSIssues(props.issues).map((group) => (
                <section
                    key={group.key}
                    className='jira-rhs-group'
                    aria-label={groupTitles[group.key]}
                    data-testid={'rhs-group-' + group.key}
                >
                    <h5 className='jira-rhs-group-header'>
                        <span>{groupTitles[group.key]}</span>
                        <span className='jira-rhs-group-count'>{group.issues.length}</span>
                    </h5>
                    {group.issues.map((issue) => (
                        <RHSIssueRow
                            key={issue.key}
                            issue={issue}
                            nowMs={nowMs}
                            onOpen={props.onOpenIssue}
                        />
                    ))}
                </section>
            ))}
            {props.loading && (
                <div
                    className='jira-rhs-list-loading'
                    data-testid='rhs-list-loading'
                >
                    <span
                        className='icon icon-refresh jira-rhs-spinner'
                        aria-hidden={true}
                    />
                    <span>{RHS_STRINGS.loadingMore}</span>
                </div>
            )}
            {props.error !== null && !props.loading && (
                <div
                    className='jira-rhs-list-error'
                    data-testid='rhs-list-error'
                >
                    <span>{props.error === 'rate_limited' ? RHS_STRINGS.rateLimited : RHS_STRINGS.error}</span>
                    <button
                        type='button'
                        className='btn btn-secondary btn-sm'
                        onClick={props.onRetry}
                    >
                        {RHS_STRINGS.retry}
                    </button>
                </div>
            )}
            {!props.isLast && !props.loading && (
                <button
                    type='button'
                    className='jira-rhs-load-more'
                    data-testid='rhs-load-more'
                    onClick={props.onLoadMore}
                >
                    {RHS_STRINGS.loadMore}
                </button>
            )}
        </div>
    );
}
