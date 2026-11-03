// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction} from 'redux';

import ActionTypes from '../action_types';

import {RHSBoardState} from 'types/rhs_board';

const defaultRHSBoardState: RHSBoardState = {
    instanceID: '',
    boardId: 0,
    boardName: '',
    view: 'list',
    board: null,
    loading: false,
    error: null,
};

// rhsBoard holds the board chosen for "Мои задачи", its sprint summary and
// the list/board view switch.
export default function rhsBoard(state: RHSBoardState = defaultRHSBoardState, action = {} as AnyAction): RHSBoardState {
    switch (action.type) {
    case ActionTypes.SET_RHS_BOARD_PREFS: {
        const sameBoard = action.data.instanceID === state.instanceID && action.data.boardId === state.boardId;
        return {
            ...state,
            instanceID: action.data.instanceID,
            boardId: action.data.boardId,
            boardName: action.data.boardName,
            view: action.data.view,
            board: sameBoard ? state.board : null,
            error: sameBoard ? state.error : null,
        };
    }
    case ActionTypes.RHS_BOARD_LOADING:
        return {...state, loading: true};
    case ActionTypes.RECEIVED_RHS_BOARD:
        if (action.boardId !== state.boardId || action.instanceID !== state.instanceID) {
            return state;
        }
        return {...state, loading: false, error: null, board: action.data, boardName: action.data.name || state.boardName};
    case ActionTypes.RHS_BOARD_ERROR:
        if (action.boardId !== state.boardId || action.instanceID !== state.instanceID) {
            return state;
        }
        return {...state, loading: false, error: action.data};
    default:
        return state;
    }
}
