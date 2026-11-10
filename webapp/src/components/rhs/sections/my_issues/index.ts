// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {
    fetchRHSBoard,
    initRHSBoard,
    listRHSBoards,
    loadMoreRHSIssues,
    loadRHSIssueTransitions,
    moveRHSIssue,
    openRHSIssue,
    resolveAndFetchRHSIssues,
    selectRHSBoard,
    setRHSListView,
} from 'actions';
import {loadRHSLaneCounts, loadRHSLanePage} from '../../../../actions/rhs_lanes';
import {
    getRHSBoardState,
    getRHSError,
    getRHSErrorMessage,
    getRHSFilter,
    getRHSInstanceID,
    getRHSIsLast,
    getRHSIssues,
    getRHSLoading,
    getRHSQuery,
    getRHSRequestId,
    getRHSSort,
    getRHSTotal,
    isRHSListStale,
} from 'selectors';

import {GlobalState} from 'types/store';

import MyIssues, {Props} from './my_issues';

type OwnProps = Pick<Props, 'instanceID'>;
type DispatchProps = Pick<Props, 'fetchRHSBoard' | 'initRHSBoard' | 'listRHSBoards' | 'loadMoreRHSIssues' | 'loadRHSIssueTransitions' | 'loadRHSLaneCounts' | 'loadRHSLanePage' | 'moveRHSIssue' | 'openRHSIssue' | 'resolveAndFetchRHSIssues' | 'selectRHSBoard' | 'setRHSListView'>;

const mapStateToProps = (state: GlobalState) => {
    const board = getRHSBoardState(state);
    return {
        filter: getRHSFilter(state),
        query: getRHSQuery(state),
        sort: getRHSSort(state),
        issues: getRHSIssues(state),
        isLast: getRHSIsLast(state),
        total: getRHSTotal(state),
        loading: getRHSLoading(state),
        requestId: getRHSRequestId(state),
        error: getRHSError(state),
        errorMessage: getRHSErrorMessage(state),
        loadedInstanceID: getRHSInstanceID(state),
        stale: isRHSListStale(state),
        boardId: board.boardId,
        boardName: board.boardName,
        board: board.board,
        boardLoading: board.loading,
        boardError: board.error,
        view: board.view,
    };
};

const actionCreators = {
    fetchRHSBoard,
    initRHSBoard,
    listRHSBoards,
    loadMoreRHSIssues,
    loadRHSIssueTransitions,
    loadRHSLaneCounts,
    loadRHSLanePage,
    moveRHSIssue,
    openRHSIssue,
    resolveAndFetchRHSIssues,
    selectRHSBoard,
    setRHSListView,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(actionCreators, dispatch) as unknown as DispatchProps;

export default connect<ReturnType<typeof mapStateToProps>, DispatchProps, OwnProps, GlobalState>(mapStateToProps, mapDispatchToProps)(MyIssues);
