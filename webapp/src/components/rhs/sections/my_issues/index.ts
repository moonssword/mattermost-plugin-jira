// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {loadMoreRHSIssues, resolveAndFetchRHSIssues} from 'actions';
import {
    getRHSError,
    getRHSIsLast,
    getRHSIssues,
    getRHSLoading,
    getRHSSort,
    getRHSTab,
    getRHSTabs,
} from 'selectors';

import {GlobalState} from 'types/store';

import MyIssues, {Props} from './my_issues';

type OwnProps = Pick<Props, 'instanceID'>;
type DispatchProps = Pick<Props, 'loadMoreRHSIssues' | 'resolveAndFetchRHSIssues'>;

const mapStateToProps = (state: GlobalState) => ({
    tab: getRHSTab(state),
    sort: getRHSSort(state),
    issues: getRHSIssues(state),
    tabs: getRHSTabs(state),
    isLast: getRHSIsLast(state),
    loading: getRHSLoading(state),
    error: getRHSError(state),
});

const actionCreators = {
    loadMoreRHSIssues,
    resolveAndFetchRHSIssues,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators<typeof actionCreators, DispatchProps>(actionCreators, dispatch);

export default connect<ReturnType<typeof mapStateToProps>, DispatchProps, OwnProps, GlobalState>(mapStateToProps, mapDispatchToProps)(MyIssues);
