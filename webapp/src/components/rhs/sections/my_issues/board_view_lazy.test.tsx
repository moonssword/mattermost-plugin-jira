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

import {RHSIssue, RHSIssuesResponse} from 'types/rhs';
import {RHSBoard, RHSLanesResponse} from 'types/rhs_board';

import {mergeRHSLanes, rhsLaneCount} from 'utils/rhs_board_lanes_lazy';
import {buildRHSLanes} from 'utils/rhs_board_lanes';

import BoardView, {Props} from './board_view';

function issue(key: string, statusId: string, categoryKey: string): RHSIssue {
    return {
        key,
        summary: 'Summary ' + key,
        browseUrl: 'http://jira.example.com/browse/' + key,
        status: {id: statusId, name: statusId, categoryKey},
        issueType: 'Task',
        project: 'TES',
        updated: '2026-01-02T00:00:00Z',
    };
}

const board: RHSBoard = {
    id: 2,
    name: 'Доска BACK',
    type: 'kanban',
    browseUrl: 'http://jira.example.com/secure/RapidBoard.jspa?rapidView=2',
    columns: [
        {name: 'К выполнению', statusIds: ['1']},
        {name: 'В работе', statusIds: ['3']},
        {name: 'Готово', statusIds: ['10001']},
    ],
};

function page(issues: RHSIssue[], nextPageToken = ''): {data: RHSIssuesResponse} {
    return {data: {issues, nextPageToken, isLast: !nextPageToken, total: null}};
}

function renderLazy(overrides: Partial<Props> = {}) {
    const counts: RHSLanesResponse = {
        supported: true,
        lanes: [
            {id: 'column:0', count: 7, categoryKey: 'new'},
            {id: 'column:1', count: 25, categoryKey: 'indeterminate'},
            {id: 'column:2', count: 40, categoryKey: 'done'},
            {id: 'outside', count: 0},
        ],
    };
    const loadLaneCounts = jest.fn(async () => ({data: counts}));
    const loadLanePage = jest.fn(async (lane: string, token?: string) => {
        if (lane === 'column:1') {
            return token ? page([issue('TES-21', '3', 'indeterminate')]) : page([issue('TES-20', '3', 'indeterminate')], '20');
        }
        if (lane === 'column:2') {
            return page([issue('TES-30', '10001', 'done')]);
        }
        return page([issue('TES-10', '1', 'new')]);
    });
    const props: Props = {
        issues: [issue('TES-30', '10001', 'done')],
        board,
        nowMs: Date.now(),
        isLast: false,
        loading: false,
        onLoadMore: jest.fn(),
        onOpenIssue: jest.fn(),
        loadTransitions: jest.fn(async () => ({data: []})),
        moveIssue: jest.fn(async () => ({data: true})),
        lanesEnabled: true,
        lanesResetKey: 'a',
        lanesRefreshKey: 1,
        loadLaneCounts,
        loadLanePage,
        ...overrides,
    };
    const utils = render(<BoardView {...props}/>);
    return {...utils, props, loadLaneCounts, loadLanePage};
}

describe('board view with columns loaded one at a time', () => {
    test('counters come at once, the busy column opens and loads its pages', async () => {
        const {loadLaneCounts, loadLanePage} = renderLazy();

        await waitFor(() => expect(screen.getByTestId('rhs-lane-column:1')).toHaveTextContent('25'));
        expect(loadLaneCounts).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('rhs-lane-column:0')).toHaveTextContent('7');
        expect(screen.getByTestId('rhs-lane-column:2')).toHaveTextContent('40');
        expect(screen.queryByTestId('rhs-lane-outside')).not.toBeInTheDocument();

        // The first page held only a finished issue; the counters pick the
        // column with work in progress.
        await waitFor(() => expect(screen.getByTestId('rhs-lane-column:1')).toHaveAttribute('aria-selected', 'true'));
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument());
        expect(loadLanePage).toHaveBeenCalledWith('column:1', '');

        // No IntersectionObserver in tests: the button stands in for scrolling.
        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-load-more'));
        });
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-21')).toBeInTheDocument());
        expect(loadLanePage).toHaveBeenCalledWith('column:1', '20');
        expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-load-more')).not.toBeInTheDocument();
    });

    test('opening another column loads it once', async () => {
        const {loadLanePage} = renderLazy();
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-lane-column:0'));
        });
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-10')).toBeInTheDocument());
        expect(screen.getByTestId('rhs-lane-column:0')).toHaveAttribute('aria-selected', 'true');

        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-lane-column:1'));
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-lane-column:0'));
        });
        expect(loadLanePage.mock.calls.filter((call) => call[0] === 'column:0')).toHaveLength(1);
    });

    test('a refresh of the list reloads the counters and the open column', async () => {
        const {props, rerender, loadLaneCounts, loadLanePage} = renderLazy();
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument());
        const before = loadLanePage.mock.calls.length;

        await act(async () => {
            rerender(
                <BoardView
                    {...props}
                    lanesRefreshKey={2}
                />,
            );
        });
        await waitFor(() => expect(loadLaneCounts).toHaveBeenCalledTimes(2));
        expect(loadLanePage.mock.calls.length).toBe(before + 1);

        // The cards stay while the column reloads.
        expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument();
    });

    test('a column chosen by the user survives a rebuilt view', async () => {
        const onLaneChange = jest.fn();
        const first = renderLazy({onLaneChange});
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument());
        await act(async () => {
            fireEvent.click(screen.getByTestId('rhs-lane-column:2'));
        });
        expect(onLaneChange).toHaveBeenLastCalledWith('column:2', true);
        first.unmount();

        // A new sort reloads the list and builds the view again.
        renderLazy({initialLane: 'column:2', initialLanePicked: true, lanesResetKey: 'b'});
        await waitFor(() => expect(screen.getByTestId('rhs-lane-column:2')).toHaveTextContent('40'));
        expect(screen.getByTestId('rhs-lane-column:2')).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-30')).toBeInTheDocument());
    });

    test('a search the server cannot split keeps the loaded list in columns', async () => {
        const {props} = renderLazy({
            issues: [issue('TES-1', '3', 'indeterminate')],
            loadLaneCounts: jest.fn(async () => ({data: {supported: false, lanes: []}})),
        });
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-1')).toBeInTheDocument());
        expect(screen.getByTestId('rhs-lane-column:1')).toHaveTextContent('1');

        fireEvent.click(screen.getByTestId('rhs-load-more'));
        expect(props.onLoadMore).toHaveBeenCalled();
    });

    test('a failed column offers to try again', async () => {
        let fail = true;
        const loadLanePage = jest.fn(async () => (fail ? {error: new Error('boom')} : page([issue('TES-20', '3', 'indeterminate')])));
        renderLazy({loadLanePage});
        await waitFor(() => expect(screen.getByTestId('rhs-lane-error')).toBeInTheDocument());

        fail = false;
        await act(async () => {
            fireEvent.click(screen.getByText('Повторить'));
        });
        await waitFor(() => expect(screen.getByTestId('rhs-bcard-TES-20')).toBeInTheDocument());
    });
});

describe('mergeRHSLanes', () => {
    test('counters and loaded pages over the first page of the list', () => {
        const lanes = buildRHSLanes([issue('A-1', '1', 'new'), issue('A-2', '99', 'new')], board, 'Вне доски');
        const merged = mergeRHSLanes(
            lanes,
            new Map([['column:0', 12], ['column:1', null], ['outside', 0]]),
            new Map([['column:2', {issues: [issue('A-3', '10001', 'done')]}], ['column:1', {issues: [], loading: true}]]),
            'Вне доски',
        );
        expect(merged.map((lane) => lane.id)).toEqual(['column:0', 'column:1', 'column:2']);
        expect(rhsLaneCount(merged[0])).toBe(12);
        expect(merged[0].issues.map((i) => i.key)).toEqual(['A-1']);
        expect(rhsLaneCount(merged[1])).toBe(0);
        expect(merged[2].issues.map((i) => i.key)).toEqual(['A-3']);
    });

    test('the outside column shows up when the server finds issues for it', () => {
        const lanes = buildRHSLanes([], board, 'Вне доски');
        const merged = mergeRHSLanes(lanes, new Map([['outside', 3]]), new Map(), 'Вне доски');
        expect(merged[merged.length - 1]).toMatchObject({id: 'outside', name: 'Вне доски', count: 3});
    });
});
