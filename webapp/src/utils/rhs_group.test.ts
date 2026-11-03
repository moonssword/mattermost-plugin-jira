// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';

import {groupRHSIssues, isRHSIssueOverdue, rhsGroupKey} from './rhs_group';

function issue(key: string, categoryKey: string, dueDate?: string): RHSIssue {
    return {
        key,
        summary: key,
        browseUrl: '',
        status: {name: categoryKey, categoryKey},
        issueType: 'Task',
        project: 'TES',
        updated: '',
        dueDate,
    };
}

describe('rhs_group', () => {
    test('rhsGroupKey maps unknown categories to other', () => {
        expect(rhsGroupKey('indeterminate')).toBe('indeterminate');
        expect(rhsGroupKey('undefined')).toBe('other');
        expect(rhsGroupKey('')).toBe('other');
    });

    test('groupRHSIssues orders groups and keeps order inside a group', () => {
        const groups = groupRHSIssues([
            issue('A', 'done'),
            issue('B', 'new'),
            issue('C', 'indeterminate'),
            issue('D', 'new'),
            issue('E', 'weird'),
        ]);
        expect(groups.map((g) => g.key)).toEqual(['indeterminate', 'new', 'done', 'other']);
        expect(groups[1].issues.map((i) => i.key)).toEqual(['B', 'D']);
    });

    test('groupRHSIssues drops empty groups', () => {
        expect(groupRHSIssues([])).toEqual([]);
        expect(groupRHSIssues([issue('A', 'new')]).map((g) => g.key)).toEqual(['new']);
    });

    test('isRHSIssueOverdue ignores done issues and future dates', () => {
        const now = new Date(2026, 10, 3, 12, 0, 0).getTime();
        expect(isRHSIssueOverdue(issue('A', 'new', '2026-11-02'), now)).toBe(true);
        expect(isRHSIssueOverdue(issue('A', 'new', '2026-11-03'), now)).toBe(false);
        expect(isRHSIssueOverdue(issue('A', 'done', '2026-01-01'), now)).toBe(false);
        expect(isRHSIssueOverdue(issue('A', 'new'), now)).toBe(false);
    });
});
