// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSCardState} from 'types/rhs_issue';

export const defaultRHSCardState: RHSCardState = {
    key: '',
    data: null,
    loading: false,
    error: null,
    errorMessage: '',
    pending: null,
    actionError: null,
    actionErrorMessage: '',
    requestId: 0,
    requestedTransition: '',
};

// rhsCard holds the open issue card. Responses for another key or an older
// request are ignored, so a slow answer never replaces a newer card.
export default function rhsCard(state: RHSCardState = defaultRHSCardState, action = {} as AnyAction): RHSCardState {
    switch (action.type) {
    case ActionTypes.RHS_CARD_LOADING: {
        const sameKey = action.data === state.key;
        return {
            ...defaultRHSCardState,
            key: action.data,
            data: sameKey ? state.data : null,
            loading: true,
            requestId: state.requestId + 1,
        };
    }
    case ActionTypes.RECEIVED_RHS_CARD:
        if (!action.data || action.data.key !== state.key || (action.requestId && action.requestId !== state.requestId)) {
            return state;
        }
        return {
            ...state,
            data: action.data,
            loading: false,
            error: null,
            errorMessage: '',
            pending: null,
            actionError: null,
            actionErrorMessage: '',
        };
    case ActionTypes.RHS_CARD_ERROR:
        if (action.key !== state.key || action.requestId !== state.requestId) {
            return state;
        }
        return {...state, loading: false, error: action.data, errorMessage: action.message || ''};
    case ActionTypes.RHS_CARD_ACTION_STARTED:
        if (action.key !== state.key) {
            return state;
        }
        return {...state, pending: action.data, actionError: null, actionErrorMessage: ''};
    case ActionTypes.RHS_CARD_ACTION_FAILED:
        if (action.key !== state.key) {
            return state;
        }
        return {...state, pending: null, actionError: action.data, actionErrorMessage: action.message || ''};
    case ActionTypes.RHS_CARD_ACTION_DONE:
        if (action.key !== state.key) {
            return state;
        }
        return {...state, pending: null};
    case ActionTypes.RHS_CARD_TRANSITION_REQUESTED:
        return {...state, requestedTransition: action.data};
    case ActionTypes.CLOSE_RHS_ISSUE:
        return {...defaultRHSCardState, requestId: state.requestId};
    default:
        return state;
    }
}
