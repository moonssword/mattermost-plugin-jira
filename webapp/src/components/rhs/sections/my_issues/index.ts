// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {loadMoreRHSIssues, resolveAndFetchRHSIssues} from 'actions';
import {
    getRHSError,
    getRHSErrorMessage,
    getRHSFilter,
    getRHSInstanceID,
    getRHSIsLast,
    getRHSIssues,
    getRHSLoading,
    getRHSQuery,
    getRHSTotal,
} from 'selectors';

import {GlobalState} from 'types/store';

import MyIssues, {Props} from './my_issues';

type OwnProps = Pick<Props, 'instanceID'>;
type DispatchProps = Pick<Props, 'loadMoreRHSIssues' | 'resolveAndFetchRHSIssues'>;

const mapStateToProps = (state: GlobalState) => ({
    filter: getRHSFilter(state),
    query: getRHSQuery(state),
    issues: getRHSIssues(state),
    isLast: getRHSIsLast(state),
    total: getRHSTotal(state),
    loading: getRHSLoading(state),
    error: getRHSError(state),
    errorMessage: getRHSErrorMessage(state),
    loadedInstanceID: getRHSInstanceID(state),
});

const actionCreators = {
    loadMoreRHSIssues,
    resolveAndFetchRHSIssues,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators<typeof actionCreators, DispatchProps>(actionCreators, dispatch);

export default connect<ReturnType<typeof mapStateToProps>, DispatchProps, OwnProps, GlobalState>(mapStateToProps, mapDispatchToProps)(MyIssues);
