// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {buildQueryString} from '../client';
import {rhsRequest} from '../client/rhs';
import {isMattermostDesktop} from '../components/rhs/rhs_desktop';
import {getPluginServerRoute} from '../selectors';

import {GlobalState} from 'types/store';

import {handleConnectFlow} from './index';

// openConnectInBrowser opens the Jira sign-in in the computer's browser, for
// the Mattermost desktop app: the app's own window has no cookies of the
// browser, and a Jira behind ADFS with Windows sign-in may leave it blank.
// The app hands addresses outside Mattermost to the system browser. Returns
// false when the instance connects the usual way (Jira Cloud), or on errors,
// so the caller falls back to the window of the app.
export async function openConnectInBrowser(baseUrl: string, instanceID: string): Promise<boolean> {
    try {
        const data = await rhsRequest<{url?: string}>(`${baseUrl}/api/v2/rhs/connect-url${buildQueryString({instance_id: instanceID})}`);
        if (!data.url || !(/^https?:\/\//).test(data.url)) {
            return false;
        }
        window.open(data.url, '_blank');
        return true;
    } catch (error) {
        return false;
    }
}

// connectJiraAccount is the panel's "Connect": in the desktop app the Jira
// sign-in opens in the computer's browser, otherwise (or when that is not
// possible) the usual connect flow runs.
export const connectJiraAccount = (instanceID: string) => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        if (isMattermostDesktop() && await openConnectInBrowser(getPluginServerRoute(getState()), instanceID)) {
            return {data: true};
        }
        return dispatch(handleConnectFlow(instanceID) as never);
    };
};
