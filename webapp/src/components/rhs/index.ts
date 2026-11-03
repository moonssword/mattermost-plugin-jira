// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {
    getConnected,
    handleConnectFlow,
    restoreRHSViewState,
    selectRHSInstance,
    setRHSSection,
    startJiraSetupWizard,
} from 'actions';
import {
    getInstalledInstances,
    getRHSActiveInstanceID,
    getRHSError,
    getRHSIssueKey,
    getRHSSection,
    getUserConnectedInstances,
    isJiraSystemAdmin,
} from 'selectors';

import {GlobalState} from 'types/store';

import Rhs, {Props} from './rhs';

type DispatchProps = Pick<Props, 'getConnected' | 'handleConnectFlow' | 'restoreRHSViewState' | 'selectRHSInstance' | 'setRHSSection' | 'startJiraSetupWizard'>;

const mapStateToProps = (state: GlobalState) => {
    return {
        installedInstances: getInstalledInstances(state) || [],
        connectedInstances: getUserConnectedInstances(state),
        activeInstanceID: getRHSActiveInstanceID(state),
        section: getRHSSection(state),
        issueKey: getRHSIssueKey(state),
        issuesError: getRHSError(state),
        isAdmin: isJiraSystemAdmin(state),
        channelId: getCurrentChannelId(state) || '',
        teamId: getCurrentTeamId(state) || '',
    };
};

const rhsDispatch = {
    getConnected,
    handleConnectFlow,
    restoreRHSViewState,
    selectRHSInstance,
    setRHSSection,
    startJiraSetupWizard,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators<typeof rhsDispatch, DispatchProps>(rhsDispatch, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(Rhs);
