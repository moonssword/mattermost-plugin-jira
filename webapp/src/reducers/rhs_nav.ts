// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSNavState, RHS_DEFAULT_SECTION, isRHSSectionID} from 'types/rhs_nav';

const defaultRHSNavState: RHSNavState = {
    section: RHS_DEFAULT_SECTION,
    issueKey: '',
};

export default function rhsNav(state: RHSNavState = defaultRHSNavState, action = {} as AnyAction): RHSNavState {
    switch (action.type) {
    case ActionTypes.SET_RHS_SECTION:
        if (!isRHSSectionID(action.data) || (action.data === state.section && !state.issueKey)) {
            return state;
        }
        return {...state, section: action.data, issueKey: ''};
    case ActionTypes.OPEN_RHS_ISSUE:
        return typeof action.data === 'string' && action.data ? {...state, issueKey: action.data} : state;
    case ActionTypes.CLOSE_RHS_ISSUE:
        return state.issueKey ? {...state, issueKey: ''} : state;
    default:
        return state;
    }
}
