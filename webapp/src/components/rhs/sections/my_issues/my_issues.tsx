// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';

import type {ResolveAndFetchArgs} from 'actions';

import {RHSErrorCode, RHSFilter, RHSIssue} from 'types/rhs';

import RHSIssueList from '../../rhs_issue_list';
import {
    RHSEmptyState,
    RHSErrorState,
    RHSLoadingState,
    RHSQueryErrorState,
    RHSRateLimitedState,
} from '../../rhs_states';
import {RHS_STRINGS} from '../../rhs_strings';

import FilterChips from './filter_chips';
import SearchBox from './search_box';

export type Props = {
    instanceID: string;
    filter: RHSFilter;
    query: string;
    issues: RHSIssue[];
    isLast: boolean;
    total: number | null;
    loading: boolean;
    error: RHSErrorCode | null;
    errorMessage: string;

    // Instance whose issues are in the store; differs right after a switch.
    loadedInstanceID: string;
    resolveAndFetchRHSIssues: (overrides?: ResolveAndFetchArgs) => Promise<unknown>;
    loadMoreRHSIssues: () => Promise<unknown>;
    openRHSIssue: (key: string) => unknown;
};

type BodyKind = 'loading' | 'rate_limited' | 'invalid_query' | 'error' | 'empty' | 'list';

export function myIssuesBodyKind(args: {loading: boolean; issuesLength: number; error: RHSErrorCode | null}): BodyKind {
    if (args.loading && args.issuesLength === 0 && args.error === null) {
        return 'loading';
    }
    if (args.error === 'invalid_query') {
        return 'invalid_query';
    }
    if (args.error === 'rate_limited' && args.issuesLength === 0) {
        return 'rate_limited';
    }
    if (args.error !== null && args.issuesLength === 0) {
        return 'error';
    }
    if (args.issuesLength === 0) {
        return 'empty';
    }
    return 'list';
}

// foundLabel renders "Найдено 3", or "Найдено 20+" when Jira gives no total
// and more pages exist.
export function foundLabel(total: number | null, loaded: number, isLast: boolean): string {
    if (total !== null) {
        return RHS_STRINGS.found + ' ' + total;
    }
    return RHS_STRINGS.found + ' ' + loaded + (isLast ? '' : '+');
}

export default function MyIssues(props: Props): JSX.Element {
    const {
        instanceID,
        filter,
        query,
        issues,
        isLast,
        total,
        loading,
        error,
        errorMessage,
        loadedInstanceID,
        resolveAndFetchRHSIssues,
        loadMoreRHSIssues,
    } = props;

    // Fetch on first mount unless this instance's list is already in the
    // store, and again whenever the active instance changes.
    const seenInstance = useRef<string | null>(null);
    useEffect(() => {
        if (!instanceID) {
            return;
        }
        const firstRun = seenInstance.current === null;
        seenInstance.current = instanceID;
        const cached = loadedInstanceID === instanceID && issues.length > 0 && error === null;
        if (firstRun && cached) {
            return;
        }
        resolveAndFetchRHSIssues({instanceID});

    // Only the instance drives refetching; other props change on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceID]);

    const searching = query.trim() !== '';

    const onSelectFilter = (next: RHSFilter) => {
        if (next === filter && !searching) {
            return;
        }
        resolveAndFetchRHSIssues({instanceID, filter: next, query: ''});
    };

    const onSearch = (next: string) => {
        resolveAndFetchRHSIssues({instanceID, query: next});
    };

    const onRetry = () => {
        resolveAndFetchRHSIssues({instanceID});
    };

    const onLoadMore = () => {
        if (!loading && !isLast) {
            loadMoreRHSIssues();
        }
    };

    const kind = myIssuesBodyKind({loading, issuesLength: issues.length, error});

    let body: JSX.Element;
    switch (kind) {
    case 'loading':
        body = <RHSLoadingState/>;
        break;
    case 'invalid_query':
        body = <RHSQueryErrorState message={errorMessage}/>;
        break;
    case 'rate_limited':
        body = <RHSRateLimitedState onRetry={onRetry}/>;
        break;
    case 'error':
        body = <RHSErrorState onRetry={onRetry}/>;
        break;
    case 'empty':
        body = <RHSEmptyState message={searching ? RHS_STRINGS.emptySearch : RHS_STRINGS.emptyFilter}/>;
        break;
    case 'list':
        body = (
            <RHSIssueList
                issues={issues}
                loading={loading}
                isLast={isLast}
                error={error}
                onLoadMore={onLoadMore}
                onRetry={onRetry}
                onOpenIssue={props.openRHSIssue}
            />
        );
        break;
    default: {
        const exhaustive: never = kind;
        body = exhaustive;
    }
    }

    return (
        <div
            className='jira-rhs-my-issues'
            data-testid='rhs-my-issues'
        >
            <div className='jira-rhs-toolbar'>
                <SearchBox
                    value={query}
                    onSearch={onSearch}
                    onRefresh={onRetry}
                    refreshing={loading}
                />
                <FilterChips
                    active={searching ? null : filter}
                    total={searching ? null : total}
                    onSelect={onSelectFilter}
                />
                {searching && kind === 'list' && (
                    <div
                        className='jira-rhs-found'
                        data-testid='rhs-found'
                    >
                        {foundLabel(total, issues.length, isLast)}
                    </div>
                )}
            </div>
            <div className='jira-rhs-body'>
                {body}
            </div>
        </div>
    );
}
