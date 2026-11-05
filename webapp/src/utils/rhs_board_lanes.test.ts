// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSIssue} from 'types/rhs';
import {RHSBoard} from 'types/rhs_board';

import {plural} from './i18n';

import {
    RHS_OUTSIDE_LANE_ID,
    buildRHSLanes,
    defaultRHSLane,
    nextRHSLane,
    pickRHSTransition,
    rhsDaysLeft,
    rhsProgressSummary,
} from './rhs_board_lanes';

function issue(key: string, id: string, categoryKey: string): RHSIssue {
    return {key, summary: key, browseUrl: '', status: {id, name: id, categoryKey}, issueType: 'Task', project: 'A', updated: ''};
}

const board: RHSBoard = {
    id: 1,
    name: 'B',
    type: 'kanban',
    browseUrl: '',
    columns: [
        {name: 'To Do', statusIds: ['1']},
        {name: 'Doing', statusIds: ['3']},
        {name: 'Review', statusIds: ['5']},
    ],
};

describe('utils/rhs_board_lanes', () => {
    test('places issues by status id and collects the rest outside', () => {
        const lanes = buildRHSLanes([issue('A-1', '3', 'indeterminate'), issue('A-2', '9', 'new'), issue('A-3', '1', 'new')], board, 'Вне доски');
        expect(lanes.map((l) => [l.name, l.issues.map((i) => i.key)])).toEqual([
            ['To Do', ['A-3']],
            ['Doing', ['A-1']],
            ['Review', []],
            ['Вне доски', ['A-2']],
        ]);
        expect(nextRHSLane(lanes, lanes[1].id)?.name).toBe('Review');
        expect(nextRHSLane(lanes, lanes[2].id)).toBeNull();
        expect(nextRHSLane(lanes, RHS_OUTSIDE_LANE_ID)).toBeNull();
        expect(defaultRHSLane(lanes)).toBe(lanes[1].id);
    });

    test('without a board the lanes are status categories', () => {
        const lanes = buildRHSLanes([issue('A-1', '3', 'done'), issue('A-2', '9', 'weird')], null, 'x');
        expect(lanes.map((l) => l.issues.map((i) => i.key))).toEqual([['A-2'], [], ['A-1']]);
        expect(defaultRHSLane(lanes)).toBe('category:new');
    });

    test('picks the transition that lands in the lane', () => {
        const transitions = [
            {id: '11', name: 'Back', to: {id: '1', name: 'To Do', categoryKey: 'new'}},
            {id: '31', name: 'Review', to: {id: '5', name: 'Review', categoryKey: 'indeterminate'}},
        ];
        const lanes = buildRHSLanes([], board, 'x');
        expect(pickRHSTransition(transitions, lanes[2])?.id).toBe('31');
        expect(pickRHSTransition(transitions, lanes[1])).toBeNull();
        const categories = buildRHSLanes([], null, 'x');
        expect(pickRHSTransition(transitions, categories[1])?.id).toBe('31');
    });

    test('Russian plural forms', () => {
        expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, ['задача', 'задачи', 'задач'], ['one', 'many']))).toEqual(
            ['задача', 'задачи', 'задач', 'задач', 'задач', 'задача', 'задачи', 'задач', 'задач'],
        );
    });

    test('days left counts calendar days', () => {
        const now = new Date(2026, 10, 10, 18, 0).getTime();
        expect(rhsDaysLeft(new Date(2026, 10, 14, 9, 0).toISOString(), now)).toBe(4);
        expect(rhsDaysLeft(new Date(2026, 10, 10, 23, 0).toISOString(), now)).toBe(0);
        expect(rhsDaysLeft(new Date(2026, 10, 8).toISOString(), now)).toBe(-2);
        expect(rhsDaysLeft('', now)).toBeNull();
    });

    test('progress summary', () => {
        expect(rhsProgressSummary({unit: 'points', todo: 13, inProgress: 21, done: 18}, 'SP')).toBe('18/52 SP');
        expect(rhsProgressSummary({unit: 'points', todo: 0, inProgress: 2.5, done: 1}, 'SP')).toBe('1/3,5 SP');
        expect(rhsProgressSummary({unit: 'issues', todo: 8, inProgress: 2, done: 2}, 'SP')).toBe('2/12 задач');
    });
});
