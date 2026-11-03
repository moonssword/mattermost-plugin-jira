// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {RHSFetchError, getRHSIssues} from '../client/rhs';
import {getDefaultUserInstanceID, getPluginServerRoute, getUserConnectedInstances} from '../selectors';
import {resolveRHSInstanceID} from 'utils/rhs_resolve';
import {loadRHSViewState, saveRHSViewState} from 'utils/rhs_view_state';

import {FetchRHSIssuesArgs, RHSFilter, RHSSort} from 'types/rhs';
import {GlobalState, pluginStateKey} from 'types/store';

// The search text is not persisted: reopening the panel starts from a filter.
export function persistCurrentRHSView(state: GlobalState): void {
    const rhs = state[pluginStateKey].rhs;
    saveRHSViewState(state.entities.users.currentUserId, {
        instance: rhs.instanceID,
        filter: rhs.filter,
        sort: rhs.sort,
    });
}

function dispatchRHSFetchError(dispatch: Dispatch, error: unknown, requestId: number) {
    const rhsError = error instanceof RHSFetchError ?
        error :
        new RHSFetchError('internal_error', error instanceof Error ? error.message : 'internal error', 0);
    dispatch({
        type: ActionTypes.RHS_ISSUES_ERROR,
        data: rhsError.errorCode,
        message: rhsError.message,
        requestId,
    });
    return {error: rhsError};
}

export const restoreRHSViewState = () => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const saved = loadRHSViewState(getState().entities.users.currentUserId);
        if (!saved) {
            return {data: null};
        }
        dispatch({
            type: ActionTypes.SET_RHS_VIEW,
            data: {
                instanceID: saved.instance,
                filter: saved.filter,
                query: '',
                sort: saved.sort,
            },
        });
        return {data: saved};
    };
};

export const fetchRHSIssues = (args: FetchRHSIssuesArgs) => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        dispatch({
            type: ActionTypes.SET_RHS_VIEW,
            data: {
                instanceID: args.instanceID,
                filter: args.filter,
                query: args.query,
                sort: args.sort,
            },
        });
        persistCurrentRHSView(getState());
        dispatch({
            type: ActionTypes.RHS_ISSUES_LOADING,
            data: {reset: true},
        });
        const requestId = getState()[pluginStateKey].rhs.requestId;

        try {
            const data = await getRHSIssues(getPluginServerRoute(getState()), args);
            dispatch({
                type: ActionTypes.RECEIVED_RHS_ISSUES,
                data,
                requestId,
            });
            return {data};
        } catch (error) {
            return dispatchRHSFetchError(dispatch, error, requestId);
        }
    };
};

export const loadMoreRHSIssues = () => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        const rhs = getState()[pluginStateKey].rhs;
        if (rhs.isLast || !rhs.nextPageToken) {
            return {data: rhs.issues};
        }

        dispatch({
            type: ActionTypes.RHS_ISSUES_LOADING,
            data: {reset: false},
        });
        const requestId = getState()[pluginStateKey].rhs.requestId;

        try {
            const data = await getRHSIssues(getPluginServerRoute(getState()), {
                instanceID: rhs.instanceID,
                filter: rhs.filter,
                query: rhs.query,
                sort: rhs.sort,
                nextPageToken: rhs.nextPageToken,
            });
            dispatch({
                type: ActionTypes.RECEIVED_RHS_ISSUES_APPEND,
                data,
                requestId,
            });
            return {data};
        } catch (error) {
            return dispatchRHSFetchError(dispatch, error, requestId);
        }
    };
};

export const refreshRHSIssues = () => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const rhs = getState()[pluginStateKey].rhs;
        return fetchRHSIssues({
            instanceID: rhs.instanceID,
            filter: rhs.filter,
            query: rhs.query,
            sort: rhs.sort,
        })(dispatch, getState);
    };
};

export type ResolveAndFetchArgs = {
    instanceID?: string;
    filter?: RHSFilter;

    // An empty string clears the search; undefined keeps the current one.
    query?: string;
    sort?: RHSSort;
};

export const resolveAndFetchRHSIssues = (overrides: ResolveAndFetchArgs = {}) => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const state = getState();
        const rhs = state[pluginStateKey].rhs;
        const instanceID = overrides.instanceID || resolveRHSInstanceID(
            rhs.instanceID,
            getUserConnectedInstances(state),
            getDefaultUserInstanceID(state) || '',
        );
        if (!instanceID) {
            return Promise.resolve({data: null});
        }

        return fetchRHSIssues({
            instanceID,
            filter: overrides.filter || rhs.filter,
            query: typeof overrides.query === 'string' ? overrides.query : rhs.query,
            sort: overrides.sort || rhs.sort,
        })(dispatch, getState);
    };
};
