// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {RHSIssue} from 'types/rhs';

import RHSIssueList from './rhs_issue_list';

function issue(key: string, categoryKey: string): RHSIssue {
    return {
        key,
        summary: 'Summary ' + key,
        browseUrl: 'http://jira.example.com/browse/' + key,
        status: {name: categoryKey, categoryKey},
        issueType: 'Task',
        project: 'TES',
        updated: '2026-01-02T00:00:00Z',
    };
}

describe('RHSIssueList loading more', () => {
    const original = window.IntersectionObserver;

    beforeEach(() => {
        (window as unknown as {IntersectionObserver: unknown}).IntersectionObserver = class {
            observe() {
                return null;
            }
            disconnect() {
                return null;
            }
        };
    });

    afterEach(() => {
        (window as unknown as {IntersectionObserver: unknown}).IntersectionObserver = original;
    });

    const renderList = (issues: RHSIssue[]) => {
        const onLoadMore = jest.fn();
        render(
            <RHSIssueList
                issues={issues}
                loading={false}
                isLast={false}
                error={null}
                onLoadMore={onLoadMore}
                onRetry={jest.fn()}
            />,
        );
        return onLoadMore;
    };

    test('loads on scroll while the last group is open', () => {
        renderList([issue('A-1', 'indeterminate')]);
        expect(screen.getByTestId('rhs-load-more-marker')).toBeInTheDocument();
    });

    test('under the folded "Done" group nothing loads until it is unfolded', () => {
        const onLoadMore = renderList([issue('A-1', 'indeterminate'), issue('A-2', 'done')]);
        expect(screen.queryByTestId('rhs-load-more-marker')).not.toBeInTheDocument();
        expect(screen.queryByTestId('rhs-load-more')).not.toBeInTheDocument();
        expect(onLoadMore).not.toHaveBeenCalled();

        // Unfolded, the new rows show: scrolling loads again.
        fireEvent.click(screen.getByTestId('rhs-group-toggle-done'));
        expect(screen.getByTestId('rhs-load-more-marker')).toBeInTheDocument();
    });
});

describe('RHSIssueList with groups loaded on their own', () => {
    const page = (issues: RHSIssue[], nextPageToken = '') => ({data: {issues, nextPageToken, isLast: !nextPageToken, total: null}});

    test('counters first, a folded group loads when unfolded', async () => {
        const loadLaneCounts = jest.fn(async () => ({data: {supported: true,
            lanes: [
                {id: 'category:new', count: 2, categoryKey: 'new'},
                {id: 'category:indeterminate', count: 1, categoryKey: 'indeterminate'},
                {id: 'category:done', count: 29, categoryKey: 'done'},
            ]}}));
        const loadLanePage = jest.fn(async (lane: string) => {
            if (lane === 'category:done') {
                return page([issue('D-1', 'done')], '20');
            }
            if (lane === 'category:new') {
                return page([issue('N-1', 'new'), issue('N-2', 'new')]);
            }
            return page([issue('I-1', 'indeterminate')]);
        });
        render(
            <RHSIssueList
                issues={[issue('I-1', 'indeterminate')]}
                loading={false}
                isLast={false}
                error={null}
                onLoadMore={jest.fn()}
                onRetry={jest.fn()}
                lanesEnabled={true}
                lanesResetKey='a'
                lanesRefreshKey={1}
                loadLaneCounts={loadLaneCounts}
                loadLanePage={loadLanePage}
            />,
        );
        await waitFor(() => expect(screen.getByTestId('rhs-group-toggle-done')).toHaveTextContent('29'));
        expect(screen.getByTestId('rhs-group-toggle-new')).toHaveTextContent('2');
        await waitFor(() => expect(screen.getByText('Summary N-2')).toBeInTheDocument());
        expect(loadLanePage.mock.calls.map((call) => call[0]).sort()).toEqual(['category:indeterminate', 'category:new']);
        expect(screen.queryByText('Summary D-1')).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-group-toggle-done'));
        });
        await waitFor(() => expect(screen.getByText('Summary D-1')).toBeInTheDocument());
        expect(loadLanePage).toHaveBeenCalledWith('category:done', '');

        // More pages of the group: no IntersectionObserver here, so the
        // fallback button stands for scrolling.
        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-group-more-done'));
        });
        expect(loadLanePage).toHaveBeenCalledWith('category:done', '20');
    });
});
