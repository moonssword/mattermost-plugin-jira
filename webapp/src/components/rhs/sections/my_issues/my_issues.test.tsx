// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';

import {RHSIssue} from 'types/rhs';

import {RHS_STRINGS} from '../../rhs_strings';

import MyIssues, {Props, foundLabel, myIssuesBodyKind} from './my_issues';
import {RHS_SEARCH_DEBOUNCE_MS} from './search_box';

const instanceID = 'http://jira.example.com';

function makeIssue(key: string, categoryKey: string, extra: Partial<RHSIssue> = {}): RHSIssue {
    return {
        key,
        summary: 'Summary ' + key,
        browseUrl: 'http://jira.example.com/browse/' + key,
        status: {name: categoryKey, categoryKey},
        issueType: 'Task',
        project: 'TES',
        updated: '2026-01-02T00:00:00Z',
        ...extra,
    };
}

const issueOne = makeIssue('TES-1', 'indeterminate');

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        instanceID,
        filter: 'assigned',
        query: '',
        issues: [],
        isLast: true,
        total: null,
        loading: false,
        error: null,
        errorMessage: '',
        loadedInstanceID: instanceID,
        stale: false,
        resolveAndFetchRHSIssues: jest.fn(async () => ({})),
        loadMoreRHSIssues: jest.fn(async () => ({})),
        openRHSIssue: jest.fn(),
        ...overrides,
    };
}

function renderMyIssues(overrides: Partial<Props> = {}) {
    const props = makeProps(overrides);
    const view = render(<MyIssues {...props}/>);
    return {props, ...view};
}

describe('components/rhs/sections/my_issues', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('body kind distinguishes loading, errors, empty and list', () => {
        expect(myIssuesBodyKind({loading: true, issuesLength: 0, error: null})).toBe('loading');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: 'rate_limited'})).toBe('rate_limited');
        expect(myIssuesBodyKind({loading: false, issuesLength: 3, error: 'invalid_query'})).toBe('invalid_query');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: 'internal_error'})).toBe('error');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: null})).toBe('empty');
        expect(myIssuesBodyKind({loading: true, issuesLength: 1, error: null})).toBe('list');
    });

    test('foundLabel uses the total or marks more pages', () => {
        expect(foundLabel(3, 3, true)).toBe('Найдено 3');
        expect(foundLabel(null, 20, false)).toBe('Найдено 20+');
        expect(foundLabel(null, 4, true)).toBe('Найдено 4');
    });

    test('fetches on mount when nothing is cached', () => {
        const {props} = renderMyIssues();
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});
    });

    test('does not refetch on mount when this instance list is cached', () => {
        const {props} = renderMyIssues({issues: [issueOne]});
        expect(props.resolveAndFetchRHSIssues).not.toHaveBeenCalled();
    });

    test('refetches on mount when live updates marked the list stale', () => {
        const {props} = renderMyIssues({issues: [issueOne], stale: true});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});
    });

    test('refetches on mount when the cached list belongs to another instance', () => {
        const {props} = renderMyIssues({issues: [issueOne], loadedInstanceID: 'http://other'});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});
    });

    test('refetches when the active instance changes', () => {
        const {props, rerender} = renderMyIssues({issues: [issueOne]});
        rerender(
            <MyIssues
                {...props}
                instanceID='http://other.example.com'
            />,
        );
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID: 'http://other.example.com'});
    });

    test('chips select a filter and clear the search; the active chip shows the total', () => {
        const {props} = renderMyIssues({issues: [issueOne], total: 7});
        expect(screen.getByTestId('rhs-filter-assigned')).toHaveTextContent('Назначены мне · 7');
        expect(screen.getByTestId('rhs-filter-assigned')).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByTestId('rhs-filter-assigned'));
        expect(props.resolveAndFetchRHSIssues).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('rhs-filter-watching'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, filter: 'watching', query: ''});
    });

    test('while searching no chip is active and a click returns to that filter', () => {
        const {props} = renderMyIssues({issues: [issueOne], query: 'export', total: 1});
        expect(screen.getByTestId('rhs-filter-assigned')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('rhs-found')).toHaveTextContent('Найдено 1');

        fireEvent.click(screen.getByTestId('rhs-filter-assigned'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, filter: 'assigned', query: ''});
    });

    test('typing searches after a pause, Enter searches at once', () => {
        jest.useFakeTimers();
        const {props} = renderMyIssues({issues: [issueOne]});
        const input = screen.getByTestId('rhs-search');

        fireEvent.change(input, {target: {value: 'экспорт'}});
        expect(props.resolveAndFetchRHSIssues).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(RHS_SEARCH_DEBOUNCE_MS);
        });
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, query: 'экспорт'});

        fireEvent.change(input, {target: {value: 'TES-1 '}});
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenLastCalledWith({instanceID, query: 'TES-1'});

        act(() => {
            jest.advanceTimersByTime(RHS_SEARCH_DEBOUNCE_MS);
        });
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledTimes(2);
    });

    test('Escape and the clear button reset the search', () => {
        const {props} = renderMyIssues({issues: [issueOne], query: 'export'});
        const input = screen.getByTestId('rhs-search');
        expect(input).toHaveValue('export');

        fireEvent.keyDown(input, {key: 'Escape'});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenLastCalledWith({instanceID, query: ''});
        expect(input).toHaveValue('');
    });

    test('issues are grouped by status category in a fixed order', () => {
        renderMyIssues({
            issues: [
                makeIssue('TES-3', 'new'),
                makeIssue('TES-1', 'indeterminate'),
                makeIssue('TES-4', 'done'),
                makeIssue('TES-2', 'indeterminate'),
            ],
        });
        const groups = screen.getAllByRole('region');
        expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
            RHS_STRINGS.groupInProgress,
            RHS_STRINGS.groupToDo,
            RHS_STRINGS.groupDone,
        ]);
        expect(screen.getByTestId('rhs-group-indeterminate')).toHaveTextContent('2');
    });

    test('an invalid query shows Jira message instead of the list', () => {
        renderMyIssues({query: 'bogus = 1', error: 'invalid_query', errorMessage: "Field 'bogus' does not exist"});
        expect(screen.getByTestId('rhs-state-query-error')).toHaveTextContent(RHS_STRINGS.queryRejected);
        expect(screen.getByTestId('rhs-state-query-error')).toHaveTextContent("Field 'bogus' does not exist");
    });

    test('empty states differ for a filter and a search', () => {
        const {rerender, props} = renderMyIssues();
        expect(screen.getByText(RHS_STRINGS.emptyFilter)).toBeInTheDocument();
        rerender(
            <MyIssues
                {...props}
                query='nothing'
            />,
        );
        expect(screen.getByText(RHS_STRINGS.emptySearch)).toBeInTheDocument();
    });

    test('error and rate limit states retry the fetch', () => {
        const {props, rerender} = renderMyIssues({error: 'internal_error'});
        (props.resolveAndFetchRHSIssues as jest.Mock).mockClear();
        fireEvent.click(screen.getByText(RHS_STRINGS.retry));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});

        rerender(
            <MyIssues
                {...props}
                error='rate_limited'
            />,
        );
        expect(screen.getByTestId('rhs-state-rate-limited')).toBeInTheDocument();
    });

    test('load more and refresh', () => {
        const {props, rerender} = renderMyIssues({issues: [issueOne], isLast: false});
        fireEvent.click(screen.getByTestId('rhs-load-more'));
        expect(props.loadMoreRHSIssues).toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('rhs-refresh'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});

        rerender(
            <MyIssues
                {...props}
                loading={true}
            />,
        );
        expect(screen.getByTestId('rhs-refresh')).toBeDisabled();
        expect(screen.getByTestId('rhs-list-loading')).toBeInTheDocument();
    });
});
