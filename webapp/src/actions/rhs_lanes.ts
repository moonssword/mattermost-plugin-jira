// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {getRHSIssues} from '../client/rhs';
import {getRHSLanes} from '../client/rhs_lanes';
import {getPluginServerRoute, getRHSEstimateField, getRHSListBoardId} from '../selectors';

import {GetRHSIssuesParams, RHSIssuesResponse} from 'types/rhs';
import {RHSLanesResponse} from 'types/rhs_board';
import {GlobalState, pluginStateKey} from 'types/store';

type Thunk<T> = (dispatch: Dispatch, getState: () => GlobalState) => T;

// The columns of the board view are not kept in the store: the view loads
// them itself, for the filter, search and board of the list.
function laneParams(state: GlobalState): GetRHSIssuesParams {
    const rhs = state[pluginStateKey].rhs;
    return {
        instanceID: rhs.instanceID,
        filter: rhs.filter,
        query: rhs.query,
        sort: rhs.sort,
        boardId: getRHSListBoardId(state, rhs.instanceID),
        estimateField: getRHSEstimateField(state),
    };
}

export const loadRHSLaneCounts = (group = ''): Thunk<Promise<{data?: RHSLanesResponse; error?: unknown}>> => {
    return async (dispatch, getState) => {
        try {
            return {data: await getRHSLanes(getPluginServerRoute(getState()), laneParams(getState()), group)};
        } catch (error) {
            return {error};
        }
    };
};

// loadRHSGroupCounts counts the status category groups of the list view.
export const loadRHSGroupCounts = (): Thunk<Promise<{data?: RHSLanesResponse; error?: unknown}>> => loadRHSLaneCounts('category');

export const loadRHSLanePage = (lane: string, nextPageToken = ''): Thunk<Promise<{data?: RHSIssuesResponse; error?: unknown}>> => {
    return async (dispatch, getState) => {
        try {
            return {data: await getRHSIssues(getPluginServerRoute(getState()), {...laneParams(getState()), lane, nextPageToken})};
        } catch (error) {
            return {error};
        }
    };
};
