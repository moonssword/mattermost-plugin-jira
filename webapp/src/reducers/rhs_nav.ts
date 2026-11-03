// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSNavState, RHS_DEFAULT_SECTION, isRHSSectionID} from 'types/rhs_nav';

const defaultRHSNavState: RHSNavState = {
    section: RHS_DEFAULT_SECTION,
};

export default function rhsNav(state: RHSNavState = defaultRHSNavState, action = {} as AnyAction): RHSNavState {
    switch (action.type) {
    case ActionTypes.SET_RHS_SECTION:
        if (!isRHSSectionID(action.data) || action.data === state.section) {
            return state;
        }
        return {...state, section: action.data};
    default:
        return state;
    }
}
