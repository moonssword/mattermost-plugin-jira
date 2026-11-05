// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {
    closeRHSSettings,
    disconnectUser,
    handleConnectFlow,
    loadRHSSettings,
    setRHSNotificationRole,
} from 'actions';
import {getInstalledInstances, getRHSActiveInstanceID, getUserConnectedInstances} from 'selectors';

import {GlobalState} from 'types/store';

import SettingsView, {Props} from './settings_view';

type DispatchProps = Pick<Props, 'closeRHSSettings' | 'disconnectUser' | 'handleConnectFlow' | 'loadRHSSettings' | 'setRHSNotificationRole'>;

const mapStateToProps = (state: GlobalState) => {
    const connected = getUserConnectedInstances(state);
    const activeID = getRHSActiveInstanceID(state);
    return {
        activeInstance: connected.find((i) => i.instance_id === activeID) || null,
        installedInstances: getInstalledInstances(state) || [],
        connectedInstances: connected,
    };
};

const actionCreators = {
    closeRHSSettings,
    disconnectUser,
    handleConnectFlow,
    loadRHSSettings,
    setRHSNotificationRole,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(actionCreators, dispatch) as unknown as DispatchProps;

export default connect(mapStateToProps, mapDispatchToProps)(SettingsView);
