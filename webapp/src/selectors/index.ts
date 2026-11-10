// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import manifest from '../manifest';

import {Instance, PluginSettings, isCloudInstance} from 'types/model';
import {
    RHSErrorCode,
    RHSFilter,
    RHSIssue,
    RHSSort,
    RHS_DEFAULT_FILTER,
    RHS_DEFAULT_SORT,
} from 'types/rhs';
import {RHSLanguagePreference, RHSStyle, RHSStylePreference} from 'types/rhs_appearance';
import {RHSSectionID, RHS_DEFAULT_SECTION} from 'types/rhs_nav';
import {UILanguage, uiLanguageForLocale} from 'utils/i18n';
import {resolveRHSInstanceID} from 'utils/rhs_resolve';
import {GlobalState, pluginStateKey} from 'types/store';

const getPluginState = (state: GlobalState) => state[pluginStateKey] || {};

export const getPluginServerRoute = (state: GlobalState) => {
    const config = getConfig(state);
    let basePath = '';
    if (config && config.SiteURL) {
        basePath = new URL(config.SiteURL).pathname;

        if (basePath && basePath[basePath.length - 1] === '/') {
            basePath = basePath.substr(0, basePath.length - 1);
        }
    }

    return basePath + '/plugins/' + manifest.id;
};

export const getCurrentUserLocale = createSelector(
    getCurrentUser,
    (user) => {
        let locale = 'en';
        if (user && user.locale) {
            locale = user.locale;
        }

        return locale;
    },
);

export const isConnectModalVisible = (state: GlobalState) => getPluginState(state).connectModalVisible;
export const isDisconnectModalVisible = (state: GlobalState) => getPluginState(state).disconnectModalVisible;

export const isCreateModalVisible = (state: GlobalState) => getPluginState(state).createModalVisible;

export const getCreateModal = (state: GlobalState) => getPluginState(state).createModal;

export const isAttachCommentToIssueModalVisible = (state: GlobalState) => getPluginState(state).attachCommentToIssueModalVisible;

export const getAttachCommentToIssueModalForPostId = (state: GlobalState) => getPluginState(state).attachCommentToIssueModalForPostId;

export const getChannelIdWithSettingsOpen = (state: GlobalState) => getPluginState(state).channelIdWithSettingsOpen;

export const getChannelSubscriptions = (state: GlobalState) => getPluginState(state).channelSubscriptions;

export const getSubscriptionTemplates = (state: GlobalState) => getPluginState(state).subscriptionTemplates;

export const getSubscriptionTemplatesForProjectKey = (state: GlobalState) => getPluginState(state).subscriptionTemplatesForProjectKey;

export const isUserConnected = (state: GlobalState) => getUserConnectedInstances(state).length > 0;

export const canUserConnect = (state: GlobalState) => getPluginState(state).userCanConnect;

export const getUserConnectedInstances = createSelector(
    (state: GlobalState) => getPluginState(state).installedInstances as Instance[],
    (state: GlobalState) => getPluginState(state).userConnectedInstances as Instance[],
    (installed, connected): Instance[] => {
        if (!installed || !connected) {
            return [];
        }

        return connected.filter((instance1) => installed.find((instance2) => instance1.instance_id === instance2.instance_id));
    },
);

export const getInstalledInstances = (state: GlobalState): Instance[] => getPluginState(state).installedInstances;

export {isCloudInstance};

export const hasCloudInstance = (state: GlobalState): boolean => {
    const installed = getInstalledInstances(state);
    if (!installed) {
        return false;
    }

    return installed.some(isCloudInstance);
};

export const getConnectedCloudInstances = createSelector(
    getUserConnectedInstances,
    (connected): Instance[] => connected.filter(isCloudInstance),
);

export const instanceIsInstalled = (state: GlobalState): boolean => getInstalledInstances(state).length > 0;

export const getDefaultUserInstanceID = (state: GlobalState) => getPluginState(state).defaultUserInstanceID;

export const getPluginSettings = (state: GlobalState): PluginSettings | null => getPluginState(state).pluginSettings;

export const getRHSInstanceID = (state: GlobalState): string => getPluginState(state).rhs?.instanceID || '';

export const getRHSFilter = (state: GlobalState): RHSFilter => getPluginState(state).rhs?.filter || RHS_DEFAULT_FILTER;

export const getRHSQuery = (state: GlobalState): string => getPluginState(state).rhs?.query || '';

export const getRHSTotal = (state: GlobalState): number | null => {
    const total = getPluginState(state).rhs?.total;
    return typeof total === 'number' ? total : null;
};

export const getRHSErrorMessage = (state: GlobalState): string => getPluginState(state).rhs?.errorMessage || '';

export const getRHSSort = (state: GlobalState): RHSSort => getPluginState(state).rhs?.sort || RHS_DEFAULT_SORT;

export const getRHSIssues = (state: GlobalState): RHSIssue[] => getPluginState(state).rhs?.issues || [];

export const getRHSIsLast = (state: GlobalState): boolean => Boolean(getPluginState(state).rhs?.isLast);

export const getRHSLoading = (state: GlobalState): boolean => Boolean(getPluginState(state).rhs?.loading);

export const getRHSError = (state: GlobalState): RHSErrorCode | null => getPluginState(state).rhs?.error || null;

export const getRHSSection = (state: GlobalState): RHSSectionID => getPluginState(state).rhsNav?.section || RHS_DEFAULT_SECTION;

// The instance the RHS works with: the saved choice if still connected, else
// the user's default, else the first connected instance.
export const getRHSActiveInstanceID = createSelector(
    getRHSInstanceID,
    getUserConnectedInstances,
    getDefaultUserInstanceID,
    (saved, connected, defaultID): string => resolveRHSInstanceID(saved, connected, defaultID || ''),
);

export const isJiraSystemAdmin = (state: GlobalState): boolean => isCurrentUserSystemAdmin(state);

export const getRHSIssueKey = (state: GlobalState): string => getPluginState(state).rhsNav?.issueKey || '';

export const getRHSCard = (state: GlobalState) => getPluginState(state).rhsCard;

export const getRHSCreatePrefill = (state: GlobalState) => getPluginState(state).rhsCreate;

export const getRHSAttachPostId = (state: GlobalState): string => getPluginState(state).rhsNav?.attachPostId || '';

export const isRHSSettingsOpen = (state: GlobalState): boolean => Boolean(getPluginState(state).rhsNav?.settingsOpen);

export const getRHSBoardState = (state: GlobalState) => getPluginState(state).rhsBoard;

// The board the list of this instance is limited to, 0 for none.
export const getRHSListBoardId = (state: GlobalState, instanceID: string): number => {
    const board = getPluginState(state).rhsBoard;
    return board && board.instanceID === instanceID ? board.boardId : 0;
};

// Story points field of the loaded board, sent along with list requests.
export const getRHSEstimateField = (state: GlobalState): string => {
    const board = getPluginState(state).rhsBoard;
    if (!board || !board.board || board.board.id !== board.boardId) {
        return '';
    }
    return board.board.estimateField || '';
};

export const isRHSListStale = (state: GlobalState): boolean => Boolean(getPluginState(state).rhs?.stale);

// Grows with every load of the list; the board view reloads its columns.
export const getRHSRequestId = (state: GlobalState): number => getPluginState(state).rhs?.requestId || 0;

export const RHS_PREFERENCE_CATEGORY = 'pp_' + manifest.id;
export const RHS_PREFERENCE_LANGUAGE = 'language';
export const RHS_PREFERENCE_STYLE = 'style';

// Personal choices are Mattermost preferences, so they follow the user between
// devices. 'auto' and 'default' mean the user did not choose anything.
function getRHSPreference(state: GlobalState, name: string): string {
    const preferences = (state.entities as unknown as {preferences?: {myPreferences?: {[key: string]: {value?: string}}}}).preferences?.myPreferences;
    return preferences?.[RHS_PREFERENCE_CATEGORY + '--' + name]?.value || '';
}

export const getRHSLanguagePreference = (state: GlobalState): RHSLanguagePreference => {
    const value = getRHSPreference(state, RHS_PREFERENCE_LANGUAGE);
    return value === 'ru' || value === 'en' ? value : 'auto';
};

// getUILocale is the locale the plugin UI follows: the user's choice, else the
// language of Mattermost.
export const getUILocale = (state: GlobalState): string => {
    const preference = getRHSLanguagePreference(state);
    return preference === 'auto' ? getCurrentUserLocale(state) : preference;
};

export const getUILanguage = (state: GlobalState): UILanguage => uiLanguageForLocale(getUILocale(state));

export const getRHSStylePreference = (state: GlobalState): RHSStylePreference => {
    const value = getRHSPreference(state, RHS_PREFERENCE_STYLE);
    return value === 'compact' || value === 'cards' ? value : 'default';
};

export const getRHSDefaultStyle = (state: GlobalState): RHSStyle => (getPluginSettings(state)?.rhs_default_style === 'cards' ? 'cards' : 'compact');

export const getRHSStyle = (state: GlobalState): RHSStyle => {
    const preference = getRHSStylePreference(state);
    return preference === 'default' ? getRHSDefaultStyle(state) : preference;
};
