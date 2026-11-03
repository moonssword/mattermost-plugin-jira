// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSNavState, RHS_DEFAULT_SECTION, isRHSSectionID} from 'types/rhs_nav';

const defaultRHSNavState: RHSNavState = {
    section: RHS_DEFAULT_SECTION,
    issueKey: '',
    attachPostId: '',
    settingsOpen: false,
};

export default function rhsNav(state: RHSNavState = defaultRHSNavState, action = {} as AnyAction): RHSNavState {
    switch (action.type) {
    case ActionTypes.SET_RHS_SECTION:
        if (!isRHSSectionID(action.data) || (action.data === state.section && !state.issueKey && !state.attachPostId && !state.settingsOpen)) {
            return state;
        }
        return {...state, section: action.data, issueKey: '', attachPostId: '', settingsOpen: false};
    case ActionTypes.OPEN_RHS_ISSUE:
        return typeof action.data === 'string' && action.data ? {...state, issueKey: action.data, attachPostId: '', settingsOpen: false} : state;
    case ActionTypes.OPEN_RHS_ATTACH:
        return typeof action.data === 'string' && action.data ? {...state, attachPostId: action.data, issueKey: '', settingsOpen: false} : state;
    case ActionTypes.OPEN_RHS_SETTINGS:
        return {...state, settingsOpen: true, issueKey: '', attachPostId: ''};
    case ActionTypes.CLOSE_RHS_SETTINGS:
        return state.settingsOpen ? {...state, settingsOpen: false} : state;
    case ActionTypes.CLOSE_RHS_ATTACH:
        return state.attachPostId ? {...state, attachPostId: ''} : state;
    case ActionTypes.CLOSE_RHS_ISSUE:
        return state.issueKey ? {...state, issueKey: ''} : state;
    default:
        return state;
    }
}
