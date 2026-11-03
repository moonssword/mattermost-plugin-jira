// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {RHSIssue} from 'types/rhs';

import RHSIssueRow, {rhsStatusClass} from './rhs_issue_row';

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
    test('compact row is one browse link with key and summary', () => {
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
        expect(screen.getByText('One')).toHaveClass('jira-rhs-row-summary');
        expect(container.innerHTML).not.toContain('api.atlassian.com');
    });

    test('the tooltip carries the full summary, status and dates', () => {
        const summary = 'x'.repeat(400);
        render(
            <RHSIssueRow
                issue={{...issueOne, summary, assigneeName: 'Иван Петров'}}
                nowMs={nowMs}
            />,
        );
        const title = screen.getByRole('link').getAttribute('title') || '';
        expect(title).toContain(summary);
        expect(title).toContain('Статус: In Progress');
        expect(title).toContain('Обновлено 1 ч назад');
        expect(title).toContain('Исполнитель: Иван Петров');
        expect(screen.getByTitle('Иван Петров')).toHaveTextContent('ИП');
    });

    test('rhsStatusClass follows statusCategory key', () => {
        expect(rhsStatusClass('done')).toBe('jira-rhs-status jira-rhs-status--done');
        expect(rhsStatusClass('weird')).toBe('jira-rhs-status jira-rhs-status--default');
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

    test('marks an overdue issue and puts the due date in the tooltip', () => {
        const {rerender} = render(
            <RHSIssueRow
                issue={{...base, dueDate: '2026-11-07'}}
                nowMs={now}
            />,
        );
        expect(screen.queryByTestId('rhs-overdue-TES-2')).not.toBeInTheDocument();
        expect(screen.getByRole('link').getAttribute('title')).toContain('Срок: 7 ноя');

        rerender(
            <RHSIssueRow
                issue={{...base, dueDate: '2026-11-01'}}
                nowMs={now}
            />,
        );
        expect(screen.getByTestId('rhs-overdue-TES-2')).toHaveTextContent('просрочено');
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
