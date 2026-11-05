// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {RHSErrorCode, RHSIssue} from 'types/rhs';

import {RHSGroupKey, groupRHSIssues} from 'utils/rhs_group';

import RHSIssueRow from './rhs_issue_row';
import {RHS_STRINGS} from './rhs_strings';

const groupTitles: Record<RHSGroupKey, string> = {
    get indeterminate() {
        return RHS_STRINGS.groupInProgress;
    },
    get new() {
        return RHS_STRINGS.groupToDo;
    },
    get done() {
        return RHS_STRINGS.groupDone;
    },
    get other() {
        return RHS_STRINGS.groupOther;
    },
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

// Finished work starts folded, like "Готово" in the design.
const COLLAPSED_BY_DEFAULT: RHSGroupKey[] = ['done'];

export default function RHSIssueList(props: Props): JSX.Element {
    const [nowMs] = useState(() => Date.now());
    const [toggled, setToggled] = useState<Set<RHSGroupKey>>(() => new Set());

    const isCollapsed = (key: RHSGroupKey) => COLLAPSED_BY_DEFAULT.includes(key) !== toggled.has(key);
    const toggle = (key: RHSGroupKey) => {
        setToggled((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <div
            className='jira-rhs-list'
            data-testid='rhs-issue-list'
        >
            {groupRHSIssues(props.issues).map((group) => {
                const collapsed = isCollapsed(group.key);
                return (
                    <section
                        key={group.key}
                        className='jira-rhs-group'
                        aria-label={groupTitles[group.key]}
                        data-testid={'rhs-group-' + group.key}
                    >
                        <h5 className='jira-rhs-group-header'>
                            <button
                                type='button'
                                className='jira-rhs-group-toggle'
                                aria-expanded={!collapsed}
                                data-testid={'rhs-group-toggle-' + group.key}
                                onClick={() => toggle(group.key)}
                            >
                                <i
                                    className={collapsed ? 'icon icon-chevron-right' : 'icon icon-chevron-down'}
                                    aria-hidden={true}
                                />
                                <span>{groupTitles[group.key]}</span>
                                <span className='jira-rhs-group-count'>{group.issues.length}</span>
                            </button>
                        </h5>
                        {!collapsed && group.issues.map((issue) => (
                            <RHSIssueRow
                                key={issue.key}
                                issue={issue}
                                nowMs={nowMs}
                                onOpen={props.onOpenIssue}
                            />
                        ))}
                    </section>
                );
            })}
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
