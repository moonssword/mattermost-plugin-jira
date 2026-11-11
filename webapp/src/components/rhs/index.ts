// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {
    getConnected,
    openRHSSettings,
    restoreRHSViewState,
    selectRHSInstance,
    setRHSSection,
    startJiraSetupWizard,
} from 'actions';
import {
    getInstalledInstances,
    getRHSActiveInstanceID,
    getRHSAttachPostId,
    getRHSError,
    getRHSInstanceID,
    getRHSIssueKey,
    getRHSQuery,
    getRHSSection,
    getRHSStyle,
    getRHSTotal,
    getUILanguage,
    getUserConnectedInstances,
    isJiraSystemAdmin,
    isRHSSettingsOpen,
} from 'selectors';

import {GlobalState} from 'types/store';
import {setUILanguage} from 'utils/i18n';

import {connectJiraAccount} from '../../actions/rhs_connect';

import Rhs, {Props} from './rhs';

type DispatchProps = Pick<Props, 'getConnected' | 'handleConnectFlow' | 'openRHSSettings' | 'restoreRHSViewState' | 'selectRHSInstance' | 'setRHSSection' | 'startJiraSetupWizard'>;

const mapStateToProps = (state: GlobalState) => {
    // Before the render below reads the text.
    const uiLanguage = getUILanguage(state);
    setUILanguage(uiLanguage);
    return {
        uiLanguage,
        uiStyle: getRHSStyle(state),
        installedInstances: getInstalledInstances(state) || [],
        connectedInstances: getUserConnectedInstances(state),
        activeInstanceID: getRHSActiveInstanceID(state),
        section: getRHSSection(state),
        issueKey: getRHSIssueKey(state),
        attachPostId: getRHSAttachPostId(state),
        settingsOpen: isRHSSettingsOpen(state),
        issuesError: getRHSError(state),
        isAdmin: isJiraSystemAdmin(state),
        channelId: getCurrentChannelId(state) || '',
        teamId: getCurrentTeamId(state) || '',
        myIssuesCount: getRHSQuery(state).trim() || getRHSInstanceID(state) !== getRHSActiveInstanceID(state) ? null : getRHSTotal(state),
    };
};

const rhsDispatch = {
    getConnected,

    // In the desktop app the Jira sign-in opens in the computer's browser.
    handleConnectFlow: connectJiraAccount,
    openRHSSettings,
    restoreRHSViewState,
    selectRHSInstance,
    setRHSSection,
    startJiraSetupWizard,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators<typeof rhsDispatch, DispatchProps>(rhsDispatch, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(Rhs);
