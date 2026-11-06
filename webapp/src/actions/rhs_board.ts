// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {RHSFetchError} from '../client/rhs';
import {getRHSBoard, getRHSBoards, getRHSIssueTransitions} from '../client/rhs_board';
import {getRHSTransitionScreen, transitionRHSIssue} from '../client/rhs_issue';
import {getPluginServerRoute, getRHSEstimateField} from '../selectors';

import {RHSBoardPrefs, RHSBoardRef, RHSListView} from 'types/rhs_board';
import {GlobalState, pluginStateKey} from 'types/store';
import {loadRHSBoardPrefs, saveRHSBoardPrefs} from 'utils/rhs_board_prefs';

import {openRHSIssue} from './rhs_card';

import {refreshRHSIssuesInPlace, resolveAndFetchRHSIssues} from './rhs';

type Thunk<T> = (dispatch: Dispatch, getState: () => GlobalState) => T;

function rhsErrorCode(error: unknown) {
    return error instanceof RHSFetchError ? error.errorCode : 'internal_error';
}

function currentPrefs(state: GlobalState): RHSBoardPrefs & {instanceID: string} {
    const b = state[pluginStateKey].rhsBoard;
    return {instanceID: b.instanceID, boardId: b.boardId, boardName: b.boardName, view: b.view};
}

function setPrefs(dispatch: Dispatch, getState: () => GlobalState, next: RHSBoardPrefs & {instanceID: string}) {
    dispatch({type: ActionTypes.SET_RHS_BOARD_PREFS, data: next});
    saveRHSBoardPrefs(getState().entities.users.currentUserId, next.instanceID, {
        boardId: next.boardId,
        boardName: next.boardName,
        view: next.view,
    });
}

// fetchRHSBoard loads the sprint summary of the chosen board. When the board
// estimates in story points the list is reloaded to carry them.
export const fetchRHSBoard = (): Thunk<Promise<unknown>> => {
    return async (dispatch, getState) => {
        const {instanceID, boardId} = currentPrefs(getState());
        if (!instanceID || !boardId) {
            return {data: null};
        }
        const hadField = getRHSEstimateField(getState());
        dispatch({type: ActionTypes.RHS_BOARD_LOADING});
        try {
            const board = await getRHSBoard(getPluginServerRoute(getState()), instanceID, boardId);
            dispatch({type: ActionTypes.RECEIVED_RHS_BOARD, data: board, boardId, instanceID});
            if (board.estimateField && board.estimateField !== hadField && getState()[pluginStateKey].rhs.instanceID === instanceID) {
                dispatch(refreshRHSIssuesInPlace() as never);
            }
            return {data: board};
        } catch (error) {
            dispatch({type: ActionTypes.RHS_BOARD_ERROR, data: rhsErrorCode(error), boardId, instanceID});
            return {error};
        }
    };
};

// initRHSBoard restores the board and view saved for this instance.
export const initRHSBoard = (instanceID: string): Thunk<unknown> => {
    return (dispatch, getState) => {
        if (!instanceID) {
            return null;
        }
        const current = getState()[pluginStateKey].rhsBoard;
        if (current.instanceID === instanceID) {
            if (current.boardId && !current.board && !current.loading) {
                return dispatch(fetchRHSBoard() as never);
            }
            return null;
        }
        const prefs = loadRHSBoardPrefs(getState().entities.users.currentUserId, instanceID);
        dispatch({type: ActionTypes.SET_RHS_BOARD_PREFS, data: {...prefs, instanceID}});
        return prefs.boardId ? dispatch(fetchRHSBoard() as never) : null;
    };
};

export const selectRHSBoard = (board: RHSBoardRef | null): Thunk<unknown> => {
    return (dispatch, getState) => {
        const prefs = currentPrefs(getState());
        setPrefs(dispatch, getState, {
            ...prefs,
            boardId: board ? board.id : 0,
            boardName: board ? board.name : '',
        });

        // The list follows the board: choosing one shows it, removing it
        // returns to the personal filter.
        dispatch(resolveAndFetchRHSIssues(board ? {filter: 'board', query: ''} : {}) as never);
        if (!board) {
            return null;
        }
        return dispatch(fetchRHSBoard() as never);
    };
};

export const setRHSListView = (view: RHSListView): Thunk<void> => {
    return (dispatch, getState) => {
        setPrefs(dispatch, getState, {...currentPrefs(getState()), view});
    };
};

export const listRHSBoards = (name: string): Thunk<Promise<{data?: RHSBoardRef[]; error?: unknown}>> => {
    return async (_dispatch, getState) => {
        const {instanceID} = currentPrefs(getState());
        try {
            return {data: await getRHSBoards(getPluginServerRoute(getState()), instanceID, name)};
        } catch (error) {
            return {error};
        }
    };
};

export const loadRHSIssueTransitions = (key: string): Thunk<Promise<{data?: Awaited<ReturnType<typeof getRHSIssueTransitions>>; error?: unknown}>> => {
    return async (_dispatch, getState) => {
        const instanceID = getState()[pluginStateKey].rhs.instanceID;
        try {
            return {data: await getRHSIssueTransitions(getPluginServerRoute(getState()), instanceID, key)};
        } catch (error) {
            return {error};
        }
    };
};

// moveRHSIssue runs a transition from a board card, then reloads the list and
// the sprint summary.
export const moveRHSIssue = (key: string, transitionID: string): Thunk<Promise<{data?: unknown; error?: unknown}>> => {
    return async (dispatch, getState) => {
        const instanceID = getState()[pluginStateKey].rhs.instanceID;
        const baseUrl = getPluginServerRoute(getState());
        try {
            const screen = await getRHSTransitionScreen(baseUrl, instanceID, key, transitionID);
            if (Object.keys(screen.fields).length > 0) {
                await dispatch(openRHSIssue(key) as never);
                dispatch({type: ActionTypes.RHS_CARD_TRANSITION_REQUESTED, data: transitionID});
                return {data: true};
            }
            await transitionRHSIssue(baseUrl, instanceID, key, transitionID);
        } catch (error) {
            return {error};
        }
        await dispatch(refreshRHSIssuesInPlace() as never);
        dispatch(fetchRHSBoard() as never);
        return {data: true};
    };
};
