// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {RHSIssue} from 'types/rhs';

import RHSIssueRow from './rhs_issue_row';

const nowMs = Date.parse('2026-01-02T01:00:00Z');

const issueOne: RHSIssue = {
    key: 'TES-1',
    summary: 'One',
    browseUrl: 'https://example.atlassian.net/browse/TES-1',
    status: {name: 'In Progress', categoryKey: 'indeterminate'},
    issueType: 'Task',
    project: 'TES',
    updated: '2026-01-02T00:00:00Z',
};

describe('components/rhs/rhs_issue_row', () => {
    test('row has one browse link and keeps the summary as text', () => {
        const {container} = render(
            <RHSIssueRow
                issue={issueOne}
                nowMs={nowMs}
            />,
        );

        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute('href', 'https://example.atlassian.net/browse/TES-1');
        expect(links[0]).toHaveTextContent('TES-1');
        expect(links[0]).toHaveTextContent('One');
        expect(screen.getByText('One')).toHaveClass('jira-rhs-issue-summary');
        expect(container.innerHTML).not.toContain('api.atlassian.com');
    });

    test('long summary keeps full text and uses the clamp class', () => {
        const summary = 'x'.repeat(400);
        render(
            <RHSIssueRow
                issue={{...issueOne, summary}}
                nowMs={nowMs}
            />,
        );

        const summaryEl = screen.getByTitle(summary);
        expect(summaryEl).toHaveClass('jira-rhs-issue-summary');
        expect(summaryEl.textContent).toHaveLength(400);
    });

    test('status pill class follows statusCategory key', () => {
        render(
            <RHSIssueRow
                issue={{
                    ...issueOne,
                    status: {name: 'Done', categoryKey: 'done'},
                }}
                nowMs={nowMs}
            />,
        );

        expect(screen.getByText('Done')).toHaveClass('jira-rhs-status--done');
    });
});

describe('components/rhs/rhs_issue_row meta', () => {
    const now = new Date(2026, 10, 3, 12, 0, 0).getTime();
    const base: RHSIssue = {
        key: 'TES-2',
        summary: 'Two',
        browseUrl: 'http://jira.example.com/browse/TES-2',
        status: {name: 'Open', categoryKey: 'new'},
        issueType: 'Task',
        project: 'TES',
        updated: new Date(now - (2 * 60 * 60 * 1000)).toISOString(),
    };

    test('shows when the issue was updated without a due date', () => {
        render(
            <RHSIssueRow
                issue={base}
                nowMs={now}
            />,
        );
        expect(screen.getByText('Обновлено 2 ч назад')).toBeInTheDocument();
    });

    test('shows the due date and marks an overdue one', () => {
        const {rerender} = render(
            <RHSIssueRow
                issue={{...base, dueDate: '2026-11-07'}}
                nowMs={now}
            />,
        );
        expect(screen.getByText('Срок: 7 ноя')).not.toHaveClass('jira-rhs-issue-time--overdue');

        rerender(
            <RHSIssueRow
                issue={{...base, dueDate: '2026-11-01'}}
                nowMs={now}
            />,
        );
        expect(screen.getByText('Срок: 1 ноя, просрочено')).toHaveClass('jira-rhs-issue-time--overdue');
    });

    test('shows the priority icon with its name', () => {
        render(
            <RHSIssueRow
                issue={{...base, priority: 'High', priorityIconUrl: 'http://jira.example.com/high.svg'}}
                nowMs={now}
            />,
        );
        expect(screen.getByAltText('High')).toBeInTheDocument();
    });
});

describe('components/rhs/rhs_issue_row open', () => {
    const issue: RHSIssue = {
        key: 'TES-3',
        summary: 'Three',
        browseUrl: 'http://jira.example.com/browse/TES-3',
        status: {name: 'Open', categoryKey: 'new'},
        issueType: 'Task',
        project: 'TES',
        updated: '',
    };

    test('a plain click opens the card, a modified click follows the link', () => {
        const onOpen = jest.fn();
        render(
            <RHSIssueRow
                issue={issue}
                nowMs={0}
                onOpen={onOpen}
            />,
        );
        const link = screen.getByRole('link');
        fireEvent.click(link);
        expect(onOpen).toHaveBeenCalledWith('TES-3');

        fireEvent.click(link, {ctrlKey: true});
        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});
