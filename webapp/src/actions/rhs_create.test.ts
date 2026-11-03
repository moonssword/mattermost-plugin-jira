// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {resetRHSPluginActions, setRHSPluginActions} from 'utils/rhs_controller';

import ActionTypes from '../action_types';

import {openRHSCreate} from './rhs_create';

function run(postMessage: string | null, args: Parameters<typeof openRHSCreate>[0]) {
    const dispatched: Array<{type: string; data?: unknown}> = [];
    const dispatch = jest.fn((action) => {
        dispatched.push(action);
        return action;
    });
    const getState = () => ({
        entities: {
            posts: {
                posts: postMessage === null ? {} : {p1: {id: 'p1', channel_id: 'c1', message: postMessage}},
            },
        },
    });
    openRHSCreate(args)(dispatch as any, getState as any);
    return dispatched;
}

describe('actions/rhs_create', () => {
    afterEach(() => {
        resetRHSPluginActions();
    });

    test('opens the create section prefilled from a post and shows the panel', () => {
        setRHSPluginActions({showRHSPlugin: {type: 'SHOW'}, hideRHSPlugin: {}, toggleRHSPlugin: {}});
        const dispatched = run('Экспорт падает\nдетали', {postId: 'p1'});

        expect(dispatched[0]).toEqual({
            type: ActionTypes.SET_RHS_CREATE,
            data: {postId: 'p1', summary: 'Экспорт падает', description: 'Экспорт падает\nдетали'},
        });
        expect(dispatched).toContainEqual({type: ActionTypes.SET_RHS_SECTION, data: 'create'});
        expect(dispatched).toContainEqual({type: 'SHOW'});
    });

    test('a description without a post prefills both fields', () => {
        const dispatched = run(null, {description: 'Текст'});
        expect(dispatched[0].data).toEqual({postId: '', summary: 'Текст', description: 'Текст'});
    });
});
