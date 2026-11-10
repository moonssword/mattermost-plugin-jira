// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {RHSErrorCode, RHSIssue} from 'types/rhs';

import {RHSGroupKey, groupRHSIssues} from 'utils/rhs_group';
import {lazyRHSGroups} from 'utils/rhs_group_lazy';

import RHSIssueRow from './rhs_issue_row';
import RHSLoadMore from './rhs_load_more';
import {RHSSkeletonRows} from './rhs_skeleton';
import {RHS_STRINGS} from './rhs_strings';
import {LoadRHSLaneCounts, LoadRHSLanePage, useRHSLanes} from './sections/my_issues/use_rhs_lanes';

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

    // Each group loads on its own, with its counter first: a folded group
    // shows the counter only and loads when unfolded. Without these the
    // list pages through the first-page list as before.
    lanesEnabled?: boolean;
    lanesResetKey?: string;
    lanesRefreshKey?: string | number;
    loadLaneCounts?: LoadRHSLaneCounts;
    loadLanePage?: LoadRHSLanePage;
};

type ShownGroup = {
    key: RHSGroupKey;
    lane: string;
    issues: RHSIssue[];
    count: number;
};

const noCounts: LoadRHSLaneCounts = () => Promise.resolve({data: {supported: false, lanes: []}});
const noPage: LoadRHSLanePage = () => Promise.resolve({error: true});

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

    const lazyWanted = Boolean(props.loadLaneCounts && props.loadLanePage) && props.lanesEnabled !== false;
    const openLanes = (['indeterminate', 'new', 'done'] as RHSGroupKey[]).filter((key) => !isCollapsed(key)).map((key) => 'category:' + key);
    const lanes = useRHSLanes({
        enabled: lazyWanted,
        resetKey: props.lanesResetKey || '',
        refreshKey: props.lanesRefreshKey ?? '',
        activeLanes: openLanes,
        loadCounts: props.loadLaneCounts || noCounts,
        loadPage: props.loadLanePage || noPage,
    });
    const lazy = lazyWanted && lanes.supported !== false;

    const groups: ShownGroup[] = lazy ? lazyRHSGroups(props.issues, lanes.counts, lanes.pages).map((g) => ({
        ...g,
        count: g.count === null ? g.issues.length : g.count,
    })) : groupRHSIssues(props.issues).map((g) => ({...g, lane: '', count: g.issues.length}));

    // Under a folded group new rows would not show, the end of the list would
    // stay in view and load page after page: unfolding loads instead.
    const lastGroup = groups[groups.length - 1];
    const autoLoad = !lastGroup || !isCollapsed(lastGroup.key);

    const groupTail = (group: ShownGroup) => {
        if (!lazy) {
            return null;
        }
        const page = lanes.pages.get(group.lane);
        if (!page) {
            return null;
        }
        if (page.error) {
            return (
                <div
                    className='jira-rhs-list-error'
                    data-testid={'rhs-group-error-' + group.key}
                >
                    <span>{RHS_STRINGS.error}</span>
                    <button
                        type='button'
                        className='btn btn-secondary btn-sm'
                        onClick={() => lanes.retry(group.lane)}
                    >
                        {RHS_STRINGS.retry}
                    </button>
                </div>
            );
        }
        if (page.loading && group.issues.length === 0) {
            return (
                <div
                    role='status'
                    aria-label={RHS_STRINGS.loading}
                    data-testid='rhs-list-loading'
                >
                    <RHSSkeletonRows count={2}/>
                </div>
            );
        }
        if (!page.isLast && page.issues.length > 0) {
            return (
                <RHSLoadMore
                    loading={page.loading}
                    onLoadMore={() => lanes.loadMore(group.lane)}
                    testId={'rhs-group-more-' + group.key}
                />
            );
        }
        return null;
    };

    return (
        <div
            className='jira-rhs-list'
            data-testid='rhs-issue-list'
        >
            {groups.map((group) => {
                const collapsed = isCollapsed(group.key);
                return (
                    <section
                        key={group.key}
                        className='jira-rhs-group'
                        data-category={group.key}
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
                                <span className='jira-rhs-group-count'>{group.count}</span>
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
                        {!collapsed && groupTail(group)}
                    </section>
                );
            })}
            {props.loading && !lazy && props.isLast && (
                <div
                    role='status'
                    aria-label={RHS_STRINGS.loading}
                    data-testid='rhs-list-loading'
                >
                    <RHSSkeletonRows count={2}/>
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
            {!lazy && !props.isLast && props.error === null && autoLoad && (
                <RHSLoadMore
                    loading={props.loading}
                    onLoadMore={props.onLoadMore}
                />
            )}
        </div>
    );
}
