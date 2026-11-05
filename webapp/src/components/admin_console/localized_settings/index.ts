// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ComponentType, createElement} from 'react';
import {connect} from 'react-redux';

import {rhsRequest} from '../../../client/rhs';
import {getCurrentUserLocale, getPluginServerRoute} from '../../../selectors';

import {GlobalState} from 'types/store';

import JiraAdminPanel, {RHSAdminSettings} from './jira_admin_panel';
import LocalizedSetting, {Props as SettingProps} from './localized_setting';
import {LOCALIZED_SETTINGS, SettingDescriptor, settingLanguage} from './settings_text';

type Registry = {
    registerAdminConsoleCustomSetting: (key: string, component: ComponentType<any>, options: {showTitle: boolean}) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const mapLanguage = (state: GlobalState) => ({language: settingLanguage(getCurrentUserLocale(state))});

const mapAdmin = (state: GlobalState) => {
    const baseUrl = getPluginServerRoute(state);
    return {
        ...mapLanguage(state),
        loadAdmin: () => rhsRequest<RHSAdminSettings>(`${baseUrl}/api/v2/rhs/admin`),
        startSetup: () => rhsRequest(`${baseUrl}/api/v2/rhs/admin/setup`, {method: 'post'}),
    };
};

function settingComponent(descriptor: SettingDescriptor) {
    const Setting = (props: Omit<SettingProps, 'descriptor'>) => createElement(LocalizedSetting, {...props, descriptor});
    return connect(mapLanguage)(Setting as ComponentType<any>); // eslint-disable-line @typescript-eslint/no-explicit-any
}

// registerLocalizedSettings replaces every setting of the plugin page with a
// component that follows the language of the user.
export function registerLocalizedSettings(registry: Registry): void {
    registry.registerAdminConsoleCustomSetting('JiraAdminPanel', connect(mapAdmin)(JiraAdminPanel as ComponentType<any>), {showTitle: false}); // eslint-disable-line @typescript-eslint/no-explicit-any
    LOCALIZED_SETTINGS.forEach((descriptor) => {
        registry.registerAdminConsoleCustomSetting(descriptor.key, settingComponent(descriptor), {showTitle: false});
    });
}
