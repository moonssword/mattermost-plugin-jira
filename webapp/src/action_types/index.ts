// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from '../manifest';

const {id: PluginId} = manifest;

export default {
    OPEN_CONNECT_MODAL: `${PluginId}_open_connect_modal`,
    CLOSE_CONNECT_MODAL: `${PluginId}_close_connect_modal`,
    OPEN_DISCONNECT_MODAL: `${PluginId}_open_disconnect_modal`,
    CLOSE_DISCONNECT_MODAL: `${PluginId}_close_disconnect_modal`,

    CLOSE_CREATE_ISSUE_MODAL: `${PluginId}_close_create_modal`,
    OPEN_CREATE_ISSUE_MODAL: `${PluginId}_open_create_modal`,
    OPEN_CREATE_ISSUE_MODAL_WITHOUT_POST: `${PluginId}_open_create_modal_without_post`,

    CLOSE_ATTACH_COMMENT_TO_ISSUE_MODAL: `${PluginId}_close_attach_modal`,
    OPEN_ATTACH_COMMENT_TO_ISSUE_MODAL: `${PluginId}_open_attach_modal`,

    RECEIVED_CONNECTED: `${PluginId}_connected`,
    RECEIVED_INSTANCE_STATUS: `${PluginId}_instance_status`,
    RECEIVED_PLUGIN_SETTINGS: `${PluginId}_plugin_settings`,

    RECEIVED_JIRA_ISSUE_METADATA: `${PluginId}_received_metadata`,
    RECEIVED_JIRA_PROJECT_METADATA: `${PluginId}_received_projects`,
    CLEAR_JIRA_ISSUE_METADATA: `${PluginId}_clear_metadata`,

    OPEN_CHANNEL_SETTINGS: `${PluginId}_open_channel_settings`,
    CLOSE_CHANNEL_SETTINGS: `${PluginId}_close_channel_settings`,

    CREATED_CHANNEL_SUBSCRIPTION: `${PluginId}_created_channel_subscription`,
    EDITED_CHANNEL_SUBSCRIPTION: `${PluginId}_edited_channel_subscription`,

    CREATED_SUBSCRIPTION_TEMPLATE: `${PluginId}_created_subscription_template`,
    DELETED_SUBSCRIPTION_TEMPLATE: `${PluginId}_deleted_subscription_template`,
    EDITED_SUBSCRIPTION_TEMPLATE: `${PluginId}_edited_subscription_template`,
    RECEIVED_SUBSCRIPTION_TEMPLATES_PROJECT_KEY: `${PluginId}_received_subscription_templates_project_key`,

    RECEIVED_CHANNEL_SUBSCRIPTIONS: `${PluginId}_recevied_channel_subscriptions`,
    RECEIVED_SUBSCRIPTION_TEMPLATES: `${PluginId}_recevied_subscription_templates`,
    DELETED_CHANNEL_SUBSCRIPTION: `${PluginId}_deleted_channel_subscription`,
    SET_RHS_VIEW: `${PluginId}_set_rhs_view`,
    RHS_ISSUES_LOADING: `${PluginId}_rhs_issues_loading`,
    RECEIVED_RHS_ISSUES: `${PluginId}_received_rhs_issues`,
    RECEIVED_RHS_ISSUES_APPEND: `${PluginId}_received_rhs_issues_append`,
    RHS_ISSUES_ERROR: `${PluginId}_rhs_issues_error`,
    SET_RHS_SECTION: `${PluginId}_set_rhs_section`,
    OPEN_RHS_ISSUE: `${PluginId}_open_rhs_issue`,
    CLOSE_RHS_ISSUE: `${PluginId}_close_rhs_issue`,
    RHS_CARD_LOADING: `${PluginId}_rhs_card_loading`,
    RECEIVED_RHS_CARD: `${PluginId}_received_rhs_card`,
    RHS_CARD_ERROR: `${PluginId}_rhs_card_error`,
    RHS_CARD_ACTION_STARTED: `${PluginId}_rhs_card_action_started`,
    RHS_CARD_ACTION_FAILED: `${PluginId}_rhs_card_action_failed`,
    RHS_CARD_ACTION_DONE: `${PluginId}_rhs_card_action_done`,
    SET_RHS_CREATE: `${PluginId}_set_rhs_create`,
    OPEN_RHS_ATTACH: `${PluginId}_open_rhs_attach`,
    OPEN_RHS_SETTINGS: `${PluginId}_open_rhs_settings`,
    CLOSE_RHS_SETTINGS: `${PluginId}_close_rhs_settings`,
    CLOSE_RHS_ATTACH: `${PluginId}_close_rhs_attach`,
    CLEAR_RHS_CREATE: `${PluginId}_clear_rhs_create`,
};
