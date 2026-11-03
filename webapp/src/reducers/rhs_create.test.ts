// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ActionTypes from '../action_types';

import rhsCreate, {defaultRHSCreate} from './rhs_create';

describe('reducers/rhs_create', () => {
    test('a new prefill bumps the nonce, clearing keeps it', () => {
        const set = rhsCreate(defaultRHSCreate, {type: ActionTypes.SET_RHS_CREATE, data: {postId: 'p1', summary: 'S', description: 'D'}});
        expect(set).toEqual({postId: 'p1', summary: 'S', description: 'D', nonce: 1});

        const cleared = rhsCreate(set, {type: ActionTypes.CLEAR_RHS_CREATE});
        expect(cleared).toEqual({postId: '', summary: '', description: '', nonce: 1});
    });
});
