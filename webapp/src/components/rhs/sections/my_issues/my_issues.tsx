// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';

import type {ResolveAndFetchArgs} from 'actions';

import {
    RHSErrorCode,
    RHSIssue,
    RHSSort,
    RHSTab,
} from 'types/rhs';
import {rhsTabsEqual} from 'utils/rhs_resolve';

import RHSHeader from '../../rhs_header';
import RHSIssueList from '../../rhs_issue_list';
import {
    RHSEmptyState,
    RHSErrorState,
    RHSLoadingState,
    RHSRateLimitedState,
} from '../../rhs_states';
import RHSTabStrip, {RHS_TAB_PANEL_ID, rhsTabDomId} from '../../rhs_tab_strip';

export type Props = {
    instanceID: string;
    tab: RHSTab;
    sort: RHSSort;
    issues: RHSIssue[];
    tabs: RHSTab[];
    isLast: boolean;
    loading: boolean;
    error: RHSErrorCode | null;
    resolveAndFetchRHSIssues: (overrides?: ResolveAndFetchArgs) => Promise<unknown>;
    loadMoreRHSIssues: () => Promise<unknown>;
};

type BodyKind = 'loading' | 'rate_limited' | 'error' | 'empty' | 'list';

export function myIssuesBodyKind(args: {loading: boolean; issuesLength: number; error: RHSErrorCode | null}): BodyKind {
    if (args.loading && args.issuesLength === 0 && args.error === null) {
        return 'loading';
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

export default function MyIssues(props: Props): JSX.Element {
    const {
        instanceID,
        tab,
        sort,
        issues,
        tabs,
        isLast,
        loading,
        error,
        resolveAndFetchRHSIssues,
        loadMoreRHSIssues,
    } = props;

    // Fetch on first mount unless a list is already cached, and again whenever
    // the active instance changes.
    const seenInstance = useRef<string | null>(null);
    useEffect(() => {
        if (!instanceID) {
            return;
        }
        const firstRun = seenInstance.current === null;
        seenInstance.current = instanceID;
        if (firstRun && tabs.length > 0 && error === null) {
            return;
        }
        resolveAndFetchRHSIssues({instanceID});

    // Only the instance drives refetching; other props change on every fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceID]);

    const onSelectTab = (next: RHSTab) => {
        if (!rhsTabsEqual(next, tab)) {
            resolveAndFetchRHSIssues({instanceID, tab: next});
        }
    };

    const onSortChange = (next: RHSSort) => {
        resolveAndFetchRHSIssues({instanceID, sort: next});
    };

    const onRetry = () => {
        resolveAndFetchRHSIssues({instanceID});
    };

    const onRefresh = () => {
        if (!loading) {
            resolveAndFetchRHSIssues({instanceID});
        }
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
    case 'rate_limited':
        body = <RHSRateLimitedState onRetry={onRetry}/>;
        break;
    case 'error':
        body = <RHSErrorState onRetry={onRetry}/>;
        break;
    case 'empty':
        body = <RHSEmptyState/>;
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
            />
        );
        break;
    default: {
        const exhaustive: never = kind;
        body = exhaustive;
    }
    }

    const showTabs = tabs.length > 0;

    return (
        <div
            className='jira-rhs-my-issues'
            data-testid='rhs-my-issues'
        >
            <RHSHeader
                sort={sort}
                loading={loading}
                onSortChange={onSortChange}
                onRefresh={onRefresh}
            />
            {showTabs && (
                <RHSTabStrip
                    tabs={tabs}
                    selectedTab={tab}
                    onSelect={onSelectTab}
                />
            )}
            <div
                className='jira-rhs-body'
                {...(showTabs ? {
                    role: 'tabpanel',
                    id: RHS_TAB_PANEL_ID,
                    'aria-labelledby': rhsTabDomId(tab),
                } : {})}
            >
                {body}
            </div>
        </div>
    );
}
