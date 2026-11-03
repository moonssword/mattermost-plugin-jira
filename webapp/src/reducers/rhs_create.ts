// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSCreatePrefill} from 'types/rhs_create';

export const defaultRHSCreate: RHSCreatePrefill = {postId: '', summary: '', description: '', nonce: 0};

export default function rhsCreate(state: RHSCreatePrefill = defaultRHSCreate, action = {} as AnyAction): RHSCreatePrefill {
    switch (action.type) {
    case ActionTypes.SET_RHS_CREATE:
        return {
            postId: action.data.postId || '',
            summary: action.data.summary || '',
            description: action.data.description || '',
            nonce: state.nonce + 1,
        };
    case ActionTypes.CLEAR_RHS_CREATE:
        // Same nonce: the form decides itself what to show after clearing.
        return {...defaultRHSCreate, nonce: state.nonce};
    default:
        return state;
    }
}
