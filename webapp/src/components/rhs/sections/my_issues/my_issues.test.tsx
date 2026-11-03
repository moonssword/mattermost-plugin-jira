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
import {RHSBoard} from 'types/rhs_board';

import {RHS_STRINGS} from '../../rhs_strings';

import {RHS_TRANSITIONS_DELAY_MS} from './board_view';
import MyIssues, {
    Props,
    RHS_SEARCH_EVENT,
    foundLabel,
    myIssuesBodyKind,
} from './my_issues';
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
        sort: 'updated',
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
        boardId: 0,
        boardName: '',
        board: null,
        boardLoading: false,
        boardError: null,
        view: 'list',
        initRHSBoard: jest.fn(),
        fetchRHSBoard: jest.fn(),
        selectRHSBoard: jest.fn(),
        setRHSListView: jest.fn(),
        listRHSBoards: jest.fn(async () => ({data: [{id: 2, name: 'Доска BACK', type: 'scrum', projectKey: 'BACK'}]})),
        loadRHSIssueTransitions: jest.fn(async () => ({data: []})),
        moveRHSIssue: jest.fn(async () => ({data: true})),
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

    test('the filter menu selects a filter and clears the search', () => {
        const {props} = renderMyIssues({issues: [issueOne], total: 7});
        expect(screen.getByTestId('rhs-filter-menu')).toHaveTextContent('Назначены мне');

        fireEvent.click(screen.getByTestId('rhs-filter-menu'));
        expect(screen.getByTestId('rhs-filter-menu-assigned')).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByTestId('rhs-filter-menu-assigned'));
        expect(props.resolveAndFetchRHSIssues).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('rhs-filter-menu'));
        fireEvent.click(screen.getByTestId('rhs-filter-menu-watching'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, filter: 'watching', query: ''});
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    test('while searching no filter is active and choosing one returns to it', () => {
        const {props} = renderMyIssues({issues: [issueOne], query: 'export', total: 1});
        expect(screen.getByTestId('rhs-filter-menu')).toHaveTextContent(RHS_STRINGS.filterMenu);
        expect(screen.getByTestId('rhs-found')).toHaveTextContent('Найдено 1');
        expect(screen.getByTestId('rhs-search')).toHaveValue('export');

        fireEvent.click(screen.getByTestId('rhs-filter-menu'));
        expect(screen.getByTestId('rhs-filter-menu-assigned')).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(screen.getByTestId('rhs-filter-menu-assigned'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, filter: 'assigned', query: ''});
    });

    test('search is hidden until the icon or "/" opens it', () => {
        renderMyIssues({issues: [issueOne]});
        expect(screen.queryByTestId('rhs-search')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('rhs-search-toggle'));
        expect(screen.getByTestId('rhs-search')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('rhs-search'), {key: 'Escape'});
        expect(screen.queryByTestId('rhs-search')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new Event(RHS_SEARCH_EVENT));
        });
        expect(screen.getByTestId('rhs-search')).toHaveFocus();
    });

    test('typing searches after a pause, Enter searches at once', () => {
        jest.useFakeTimers();
        const {props} = renderMyIssues({issues: [issueOne]});
        fireEvent.click(screen.getByTestId('rhs-search-toggle'));
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

    test('sort menu refetches with the chosen order', () => {
        const {props} = renderMyIssues({issues: [issueOne]});
        fireEvent.click(screen.getByTestId('rhs-sort-menu'));
        fireEvent.click(screen.getByTestId('rhs-sort-menu-created'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID, sort: 'created'});
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

        // Finished work starts folded.
        expect(screen.queryByTestId('rhs-issue-TES-4')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('rhs-group-toggle-done'));
        expect(screen.getByTestId('rhs-issue-TES-4')).toBeInTheDocument();
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

        fireEvent.click(screen.getByTestId('rhs-filter-menu'));
        fireEvent.click(screen.getByTestId('rhs-filter-menu-refresh'));
        expect(props.resolveAndFetchRHSIssues).toHaveBeenCalledWith({instanceID});

        rerender(
            <MyIssues
                {...props}
                loading={true}
            />,
        );
        expect(screen.getByTestId('rhs-list-loading')).toBeInTheDocument();
    });
});

const scrumBoard: RHSBoard = {
    id: 2,
    name: 'Доска BACK',
    type: 'scrum',
    browseUrl: 'http://jira.example.com/secure/RapidBoard.jspa?rapidView=2',
    columns: [
        {name: 'К выполнению', statusIds: ['1']},
        {name: 'В работе', statusIds: ['3']},
        {name: 'Ревью', statusIds: ['5']},
    ],
    estimateField: 'customfield_10111',
    sprint: {id: 34, name: 'Спринт 34', endDate: new Date(Date.now() + (4 * 86400000)).toISOString()},
    progress: {unit: 'points', todo: 13, inProgress: 21, done: 18},
};

describe('components/rhs/sections/my_issues board (4в)', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('loads the saved board for the instance', () => {
        const {props} = renderMyIssues();
        expect(props.initRHSBoard).toHaveBeenCalledWith(instanceID);
    });

    test('no board: no strip, the filter menu offers to choose one', async () => {
        const {props} = renderMyIssues({issues: [issueOne]});
        expect(screen.queryByTestId('rhs-sprint-strip')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('rhs-filter-menu'));
        expect(screen.getByTestId('rhs-filter-menu-board')).toHaveTextContent(RHS_STRINGS.boardChoose);
        fireEvent.click(screen.getByTestId('rhs-filter-menu-board'));

        expect(await screen.findByTestId('rhs-board-2')).toHaveTextContent('Доска BACK');
        fireEvent.click(screen.getByTestId('rhs-board-2'));
        expect(props.selectRHSBoard).toHaveBeenCalledWith(expect.objectContaining({id: 2}));
        expect(screen.queryByTestId('rhs-board-picker')).not.toBeInTheDocument();
    });

    test('the strip shows sprint progress in one line and expands', () => {
        renderMyIssues({issues: [issueOne], boardId: 2, boardName: 'Доска BACK', board: scrumBoard});
        expect(screen.getByTestId('rhs-sprint-strip')).toHaveTextContent('Спринт 34');
        expect(screen.getByTestId('rhs-sprint-summary')).toHaveTextContent('18/52 SP · 4 дн.');
        expect(screen.getByTestId('rhs-board-pill')).toHaveTextContent('Доска BACK');

        fireEvent.click(screen.getByTestId('rhs-sprint-toggle'));
        expect(screen.getByTestId('rhs-sprint-legend')).toHaveTextContent('13 SP к выполнению');
        expect(screen.getByTestId('rhs-sprint-legend')).toHaveTextContent('18 SP готово');
    });

    test('view switch asks to remember the board view', () => {
        const {props} = renderMyIssues({issues: [issueOne]});
        fireEvent.click(screen.getByTestId('rhs-view-board'));
        expect(props.setRHSListView).toHaveBeenCalledWith('board');
    });

    test('board view: lanes with counts and a move to the next column', async () => {
        jest.useFakeTimers();
        const issues = [
            makeIssue('TES-1', 'indeterminate', {status: {id: '3', name: 'В работе', categoryKey: 'indeterminate'}, estimate: 5}),
            makeIssue('TES-2', 'new', {status: {id: '1', name: 'Открыта', categoryKey: 'new'}}),
        ];
        const loadRHSIssueTransitions = jest.fn(async () => ({data: [{id: '41', name: 'На ревью', to: {id: '5', name: 'Ревью', categoryKey: 'indeterminate'}}]}));
        const {props} = renderMyIssues({issues, view: 'board', boardId: 2, boardName: 'Доска BACK', board: scrumBoard, loadRHSIssueTransitions});

        expect(screen.getByTestId('rhs-sprint-legend')).toBeInTheDocument();
        expect(screen.getByTestId('rhs-lane-column:1')).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('rhs-lane-column:0')).toHaveTextContent('1');
        expect(screen.getByTestId('rhs-bcard-TES-1')).toHaveTextContent('5');
        expect(screen.queryByTestId('rhs-bcard-TES-2')).not.toBeInTheDocument();

        fireEvent.mouseEnter(screen.getByTestId('rhs-bcard-TES-1'));
        await act(async () => {
            jest.advanceTimersByTime(RHS_TRANSITIONS_DELAY_MS);
        });
        expect(loadRHSIssueTransitions).toHaveBeenCalledWith('TES-1');
        const move = screen.getByTestId('rhs-move-TES-1');
        expect(move).toHaveTextContent('→ Ревью');
        await act(async () => {
            fireEvent.click(move);
        });
        expect(props.moveRHSIssue).toHaveBeenCalledWith('TES-1', '41');

        fireEvent.click(screen.getByTestId('rhs-lane-column:0'));
        expect(screen.getByTestId('rhs-bcard-TES-2')).toBeInTheDocument();
    });
});
