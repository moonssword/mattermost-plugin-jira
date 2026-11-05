// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ComponentType} from 'react';
import {connect} from 'react-redux';
import {Dispatch, bindActionCreators} from 'redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {isDirectChannel, isGroupChannel} from 'mattermost-redux/utils/channel_utils';

import {
    closeChannelSettings,
    createChannelSubscription,
    createSubscriptionTemplate,
    deleteChannelSubscription,
    deleteSubscriptionTemplate,
    editChannelSubscription,
    editSubscriptionTemplate,
    fetchAllSubscriptionTemplates,
    fetchChannelSubscriptions,
    fetchJiraIssueMetadataForProjects,
    fetchJiraProjectMetadataForAllInstances,
    fetchSubscriptionTemplatesForProjectKey,
    getConnected,
    loadRHSChannelSubscriptions,
    openChannelSettings,
    searchTeamFields,
    sendEphemeralPost,
    setRHSSubscriptionPaused,
} from 'actions';
import {
    getChannelSubscriptions,
    getInstalledInstances,
    getPluginSettings,
    getSubscriptionTemplates,
    getUserConnectedInstances,
} from 'selectors';

import {GlobalState} from 'types/store';

import ChannelSection from './channel_section';

// The same data the subscription modal gets, for the current channel, so the
// embedded editor behaves exactly like in the modal.
const mapStateToProps = (state: GlobalState) => {
    const channelId = getCurrentChannelId(state) || '';
    const channel = channelId ? getChannel(state, channelId) || null : null;
    const isDirectOrGroup = Boolean(channel && (isDirectChannel(channel) || isGroupChannel(channel)));
    return {
        channelId,
        channel,
        isDirectOrGroup,
        omitDisplayName: isDirectOrGroup,
        theme: getTheme(state),
        channelSubscriptions: getChannelSubscriptions(state)[channelId] || [],
        subscriptionTemplates: getSubscriptionTemplates(state).subscriptionTemplates || [],
        installedInstances: getInstalledInstances(state),
        connectedInstances: getUserConnectedInstances(state),
        securityLevelEmptyForJiraSubscriptions: getPluginSettings(state)?.security_level_empty_for_jira_subscriptions,
    };
};

const actionCreators = {
    close: closeChannelSettings,
    createChannelSubscription,
    createSubscriptionTemplate,
    deleteChannelSubscription,
    deleteSubscriptionTemplate,
    editChannelSubscription,
    editSubscriptionTemplate,
    fetchAllSubscriptionTemplates,
    fetchChannelSubscriptions,
    fetchJiraIssueMetadataForProjects,
    fetchJiraProjectMetadataForAllInstances,
    fetchSubscriptionTemplatesForProjectKey,
    getConnected,
    loadRHSChannelSubscriptions,
    openChannelSettings,
    searchTeamFields,
    sendEphemeralPost,
    setRHSSubscriptionPaused,
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(actionCreators, dispatch);

// The editor's prop types come from the upstream modal and do not line up
// with bindActionCreators; the section only receives instanceID from outside.
export default connect(mapStateToProps, mapDispatchToProps)(ChannelSection as never) as unknown as ComponentType<{instanceID: string}>;
