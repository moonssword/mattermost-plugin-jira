// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType, ReactElement} from 'react';

import Rhs from 'components/rhs';
import JiraIcon from 'components/icon';
import {RHS_STRINGS} from 'components/rhs/rhs_strings';

import {openJiraRHS, toggleJiraRHS} from '../actions/rhs_nav';
import {getPluginServerRoute} from '../selectors';

import {GlobalState} from 'types/store';

import {setRHSPluginActions} from './rhs_controller';

export const JIRA_RHS_TITLE = RHS_STRINGS.title;

export type RHSRegistry = {
    registerAppBarComponent: (
        iconUrl: string,
        action: undefined,
        tooltipText: string,
        supportedProductIds?: undefined,
        rhsComponent?: ComponentType,
        rhsTitle?: string,
    ) => unknown;
    registerChannelHeaderButtonAction?: (
        icon: ReactElement,
        action: () => void,
        dropdownText: string,
        tooltipText: string,
    ) => unknown;
    registerChannelHeaderMenuAction?: (
        text: string,
        action: (channelId: string) => void,
    ) => unknown;
};

// Matches the host store passed to initialize; thunks are dispatched as-is.
export type RHSStore = {
    dispatch: (action: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any
    getState: () => unknown;
};

// The RHS is registered whenever the admin enabled it. Without an installed
// instance it shows the "ask your admin" or setup-wizard screen.
export function shouldRegisterJiraRHS(settings: unknown): boolean {
    if (!settings || typeof settings !== 'object') {
        return false;
    }
    return 'rhs_enabled' in settings && settings.rhs_enabled === true;
}

export function getJiraAppBarIconUrl(state: GlobalState): string {
    return getPluginServerRoute(state) + '/public/icon.svg';
}

// registerJiraRHS adds the three entry points of the panel:
//   - the App Bar icon (desktop and web);
//   - a channel header button: on servers with the App Bar it is hidden on
//     desktop but still shown in the mobile web channel menu;
//   - an item in the channel header menu, the desktop entry inside a channel.
export function registerJiraRHS(registry: RHSRegistry, store: RHSStore): void {
    const state = store.getState() as GlobalState;

    // App Bar omits the action and product ids; pass undefined positionally.
    /* eslint-disable no-undefined */
    const appBar = registry.registerAppBarComponent(
        getJiraAppBarIconUrl(state),
        undefined,
        JIRA_RHS_TITLE,
        undefined,
        Rhs,
        JIRA_RHS_TITLE,
    );
    /* eslint-enable no-undefined */

    if (appBar && typeof appBar === 'object' && 'rhsComponent' in appBar) {
        setRHSPluginActions((appBar as {rhsComponent: unknown}).rhsComponent);
    }

    registry.registerChannelHeaderButtonAction?.(
        React.createElement(JiraIcon),
        () => store.dispatch(toggleJiraRHS()),
        JIRA_RHS_TITLE,
        RHS_STRINGS.openPanel,
    );

    registry.registerChannelHeaderMenuAction?.(
        RHS_STRINGS.openPanel,
        () => store.dispatch(openJiraRHS()),
    );
}
