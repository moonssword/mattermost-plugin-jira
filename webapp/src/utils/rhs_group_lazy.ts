// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';

import {RHSGroupKey, rhsGroupKey} from './rhs_group';

// The groups of the list view when each is loaded on its own: the server
// counts them, and a group's issues come when it is unfolded.
export type RHSLazyGroup = {
    key: RHSGroupKey;
    lane: string;
    issues: RHSIssue[];
    count: number | null;
};

const LAZY_GROUPS: RHSGroupKey[] = ['indeterminate', 'new', 'done'];

export function rhsGroupLane(key: RHSGroupKey): string {
    return 'category:' + (key === 'other' ? 'new' : key);
}

// lazyRHSGroups shows the counted groups. A group not loaded yet shows the
// issues of the first page of the list meanwhile; issues of an unknown
// category go with "To do", as the server counts them.
export function lazyRHSGroups(
    firstPage: RHSIssue[],
    counts: Map<string, number | null>,
    pages: Map<string, {issues: RHSIssue[]; loading?: boolean}>,
): RHSLazyGroup[] {
    return LAZY_GROUPS.map((key) => {
        const lane = rhsGroupLane(key);
        const page = pages.get(lane);
        const placeholder = firstPage.filter((issue) => {
            const group = rhsGroupKey(issue.status?.categoryKey || '');
            return group === key || (key === 'new' && group === 'other');
        });
        const loaded = page && (page.issues.length > 0 || !page.loading);
        const count = counts.has(lane) ? counts.get(lane) ?? null : null;
        return {key, lane, issues: loaded ? page.issues : placeholder, count};
    }).filter((group) => (group.count === null ? group.issues.length : group.count) > 0);
}
