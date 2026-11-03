// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';

import {
    assignRHSCard,
    closeRHSIssue,
    commentRHSCard,
    fetchRHSIssueCard,
    searchRHSCardAssignees,
    shareRHSCard,
    transitionRHSCard,
} from 'actions';
import {getRHSCard} from 'selectors';

import {GlobalState} from 'types/store';

import IssueCard, {Props} from './issue_card';

type DispatchProps = Omit<Props, 'card' | 'channelId'>;

const mapStateToProps = (state: GlobalState) => ({
    card: getRHSCard(state),
    channelId: getCurrentChannelId(state) || '',
});

const actionCreators = {
    assignRHSCard,
    closeRHSIssue,
    commentRHSCard,
    fetchRHSIssueCard,
    searchRHSCardAssignees,
    shareRHSCard,
    transitionRHSCard,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators<typeof actionCreators, DispatchProps>(actionCreators, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(IssueCard);
