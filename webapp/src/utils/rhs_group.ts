// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';

export type RHSGroupKey = 'indeterminate' | 'new' | 'done' | 'other';

export type RHSIssueGroup = {
    key: RHSGroupKey;
    issues: RHSIssue[];
};

// Work in progress first, then what is next, then finished work.
export const RHS_GROUP_ORDER: RHSGroupKey[] = ['indeterminate', 'new', 'done', 'other'];

export function rhsGroupKey(categoryKey: string): RHSGroupKey {
    switch (categoryKey) {
    case 'indeterminate':
    case 'new':
    case 'done':
        return categoryKey;
    default:
        return 'other';
    }
}

// groupRHSIssues splits issues by status category and keeps the server order
// (most recently updated first) inside each group. Empty groups are dropped.
export function groupRHSIssues(issues: RHSIssue[]): RHSIssueGroup[] {
    const byKey = new Map<RHSGroupKey, RHSIssue[]>();
    for (const issue of issues) {
        const key = rhsGroupKey(issue.status?.categoryKey || '');
        const list = byKey.get(key);
        if (list) {
            list.push(issue);
        } else {
            byKey.set(key, [issue]);
        }
    }
    return RHS_GROUP_ORDER
        .filter((key) => byKey.has(key))
        .map((key) => ({key, issues: byKey.get(key) as RHSIssue[]}));
}

// isRHSIssueOverdue compares the "YYYY-MM-DD" due date with the local date.
export function isRHSIssueOverdue(issue: RHSIssue, nowMs: number): boolean {
    if (!issue.dueDate || issue.status?.categoryKey === 'done') {
        return false;
    }
    const now = new Date(nowMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    return issue.dueDate < today;
}
