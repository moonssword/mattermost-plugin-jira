// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import {RHSIssue, RHSTab} from 'types/rhs';

import {RHS_STRINGS} from '../../rhs_strings';

import MyIssues, {Props, myIssuesBodyKind} from './my_issues';

const assignedTab: RHSTab = {kind: 'assigned', name: 'Assigned to me'};
const inProgressTab: RHSTab = {kind: 'category', name: 'In Progress', key: 'indeterminate'};
const instanceID = 'http://jira.example.com';

const issueOne: RHSIssue = {
    key: 'TES-1',
    summary: 'One',
    browseUrl: 'http://jira.example.com/browse/TES-1',
    status: {name: 'In Progress', categoryKey: 'indeterminate'},
    issueType: 'Task',
    project: 'TES',
    updated: '2026-01-02T00:00:00Z',
};

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        instanceID,
        tab: assignedTab,
        sort: 'updated',
        issues: [],
        tabs: [],
        isLast: true,
        loading: false,
        error: null,
        resolveAndFetchRHSIssues: jest.fn(async () => ({})),
        loadMoreRHSIssues: jest.fn(async () => ({})),
        ...overrides,
    };
}

function renderMyIssues(overrides: Partial<Props> = {}) {
    const props = makeProps(overrides);
    const view = render(<MyIssues {...props}/>);
    return {props, ...view};
}

describe('components/rhs/sections/my_issues', () => {
    test('body kind distinguishes loading, errors, empty and list', () => {
        expect(myIssuesBodyKind({loading: true, issuesLength: 0, error: null})).toBe('loading');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: 'rate_limited'})).toBe('rate_limited');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: 'internal_error'})).toBe('error');
        expect(myIssuesBodyKind({loading: false, issuesLength: 0, error: null})).toBe('empty');
        expect(myIssuesBodyKind({loading: true, issuesLength: 1, error: null})).toBe('list');
    });

    test('fetches on mount when nothing is cached', () => {
        const {props} = renderMyIssues();
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});
    });

    test('does not refetch on mount when a list is cached', () => {
        const {props} = renderMyIssues({tabs: [assignedTab], issues: [issueOne]});
        expect(props.resolveAndFetchRHSIssues).not.toHaveBeenCalled();
    });

    test('refetches when the active instance changes', () => {
        const {props, rerender} = renderMyIssues({tabs: [assignedTab], issues: [issueOne]});
        rerender(
            <MyIssues
                {...props}
                instanceID='http://other.example.com'
            />,
        );
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID: 'http://other.example.com'});
    });

    test('loading state is not the empty state', () => {
        renderMyIssues({loading: true});
        expect(screen.getByTestId('rhs-state-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-state-empty')).toBeNull();
    });

    test('empty state renders after a successful zero-row fetch', () => {
        renderMyIssues({tabs: [assignedTab]});
        expect(screen.getByTestId('rhs-state-empty')).toBeInTheDocument();
        expect(screen.getByText(RHS_STRINGS.empty)).toBeInTheDocument();
    });

    test('error state retries the fetch', () => {
        const {props} = renderMyIssues({error: 'internal_error'});
        (props.resolveAndFetchRHSIssues as jest.Mock).mockClear();
        fireEvent.click(screen.getByText(RHS_STRINGS.retry));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});
    });

    test('rate_limited renders the distinct rate-limit state', () => {
        renderMyIssues({error: 'rate_limited'});
        expect(screen.getByTestId('rhs-state-rate-limited')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-state-error')).toBeNull();
    });

    test('changing sort refetches with the new sort', () => {
        const {props} = renderMyIssues({tabs: [assignedTab], issues: [issueOne]});
        fireEvent.change(screen.getByTestId('rhs-sort'), {target: {value: 'created'}});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, sort: 'created'});
    });

    test('assigned tab is labelled in Russian and tabs switch the list', () => {
        const {props} = renderMyIssues({tabs: [assignedTab, inProgressTab], issues: [issueOne]});
        const assigned = screen.getByRole('tab', {name: RHS_STRINGS.assignedTab});
        fireEvent.keyDown(assigned, {key: 'ArrowRight'});
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, tab: inProgressTab});
    });

    test('load more is shown when not last and calls loadMoreRHSIssues', () => {
        const {props} = renderMyIssues({tabs: [assignedTab], issues: [issueOne], isLast: false});
        fireEvent.click(screen.getByTestId('rhs-load-more'));
        expect(props.loadMoreRHSIssues).toHaveBeenCalled();
    });

    test('refresh is disabled while a page is loading', () => {
        renderMyIssues({tabs: [assignedTab], issues: [issueOne], loading: true});
        expect(screen.getByTestId('rhs-refresh')).toBeDisabled();
        expect(screen.getByTestId('rhs-list-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-load-more')).toBeNull();
    });

    test('the list toolbar has no new ticket button', () => {
        renderMyIssues({tabs: [assignedTab], issues: [issueOne]});
        expect(screen.queryByTestId('rhs-new-ticket')).toBeNull();
    });
});
