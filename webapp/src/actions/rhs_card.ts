// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {RHSFetchError} from '../client/rhs';
import {
    assignRHSIssue,
    commentRHSIssue,
    getRHSIssueCard,
    searchRHSAssignableUsers,
    shareRHSIssue,
    transitionRHSIssue,
} from '../client/rhs_issue';
import {getPluginServerRoute, getRHSActiveInstanceID} from '../selectors';

import {
    RHSAssignTarget,
    RHSCardAction,
    RHSIssueCard,
    RHSUser,
} from 'types/rhs_issue';
import {GlobalState, pluginStateKey} from 'types/store';

import {openJiraRHS} from './rhs_nav';

function asRHSError(error: unknown): RHSFetchError {
    if (error instanceof RHSFetchError) {
        return error;
    }
    return new RHSFetchError('internal_error', error instanceof Error ? error.message : '', 0);
}

function cardContext(state: GlobalState) {
    return {
        baseUrl: getPluginServerRoute(state),
        instanceID: getRHSActiveInstanceID(state),
        key: state[pluginStateKey].rhsCard.key,
    };
}

export const fetchRHSIssueCard = (key: string) => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        dispatch({type: ActionTypes.RHS_CARD_LOADING, data: key});
        const requestId = getState()[pluginStateKey].rhsCard.requestId;
        const {baseUrl, instanceID} = cardContext(getState());
        try {
            const data = await getRHSIssueCard(baseUrl, instanceID, key);
            dispatch({type: ActionTypes.RECEIVED_RHS_CARD, data, requestId});
            return {data};
        } catch (error) {
            const rhsError = asRHSError(error);
            dispatch({type: ActionTypes.RHS_CARD_ERROR, key, requestId, data: rhsError.errorCode, message: rhsError.message});
            return {error: rhsError};
        }
    };
};

// openRHSIssue shows the card of an issue in the panel and opens the panel if
// it is closed, so links and post actions can use it too.
export const openRHSIssue = (key: string) => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const upper = key.trim().toUpperCase();
        dispatch({type: ActionTypes.OPEN_RHS_ISSUE, data: upper});
        openJiraRHS()(dispatch);
        return fetchRHSIssueCard(upper)(dispatch, getState);
    };
};

export const closeRHSIssue = () => ({type: ActionTypes.CLOSE_RHS_ISSUE});

// runCardAction marks the card busy, calls Jira through the plugin and
// stores the card the server returns after the change.
function runCardAction(kind: RHSCardAction, call: (baseUrl: string, instanceID: string, key: string) => Promise<RHSIssueCard>) {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        const {baseUrl, instanceID, key} = cardContext(getState());
        if (!key || getState()[pluginStateKey].rhsCard.pending) {
            return {error: new RHSFetchError('invalid_request', 'busy', 0)};
        }
        dispatch({type: ActionTypes.RHS_CARD_ACTION_STARTED, key, data: kind});
        try {
            const data = await call(baseUrl, instanceID, key);
            dispatch({type: ActionTypes.RECEIVED_RHS_CARD, data});
            return {data};
        } catch (error) {
            const rhsError = asRHSError(error);
            dispatch({type: ActionTypes.RHS_CARD_ACTION_FAILED, key, data: rhsError.errorCode, message: rhsError.message});
            return {error: rhsError};
        }
    };
}

export const transitionRHSCard = (transitionID: string) =>
    runCardAction('transition', (baseUrl, instanceID, key) => transitionRHSIssue(baseUrl, instanceID, key, transitionID));

export const assignRHSCard = (target: RHSAssignTarget) =>
    runCardAction('assign', (baseUrl, instanceID, key) => assignRHSIssue(baseUrl, instanceID, key, target));

export const commentRHSCard = (text: string) =>
    runCardAction('comment', (baseUrl, instanceID, key) => commentRHSIssue(baseUrl, instanceID, key, text));

// shareRHSCard posts the issue to a channel; the card itself does not change.
export const shareRHSCard = (channelID: string) => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        const {baseUrl, instanceID, key} = cardContext(getState());
        dispatch({type: ActionTypes.RHS_CARD_ACTION_STARTED, key, data: 'share'});
        try {
            const data = await shareRHSIssue(baseUrl, instanceID, key, channelID);
            dispatch({type: ActionTypes.RHS_CARD_ACTION_DONE, key});
            return {data};
        } catch (error) {
            const rhsError = asRHSError(error);
            dispatch({type: ActionTypes.RHS_CARD_ACTION_FAILED, key, data: rhsError.errorCode, message: rhsError.message});
            return {error: rhsError};
        }
    };
};

export const searchRHSCardAssignees = (query: string) => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Promise<{data?: RHSUser[]; error?: RHSFetchError}> => {
        const {baseUrl, instanceID, key} = cardContext(getState());
        try {
            return {data: await searchRHSAssignableUsers(baseUrl, instanceID, key, query)};
        } catch (error) {
            return {error: asRHSError(error)};
        }
    };
};
