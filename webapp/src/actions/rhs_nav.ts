// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction, Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {doFetch} from '../client';

import {getRHSPluginActions} from 'utils/rhs_controller';
import {RHSSectionID} from 'types/rhs_nav';
import {RHS_DEFAULT_TAB} from 'types/rhs';
import {GlobalState, pluginStateKey} from 'types/store';

import {persistCurrentRHSView} from './rhs';

export const setRHSSection = (section: RHSSectionID) => ({
    type: ActionTypes.SET_RHS_SECTION,
    data: section,
});

function dispatchHostAction(dispatch: Dispatch, action: unknown): boolean {
    if (!action) {
        return false;
    }
    dispatch(action as AnyAction);
    return true;
}

// Opens the Jira RHS, optionally on a given section. Safe to call from post
// menu actions and channel header actions.
export const openJiraRHS = (section?: RHSSectionID) => {
    return (dispatch: Dispatch) => {
        if (section) {
            dispatch(setRHSSection(section));
        }
        return {data: dispatchHostAction(dispatch, getRHSPluginActions()?.showRHSPlugin)};
    };
};

export const toggleJiraRHS = () => {
    return (dispatch: Dispatch) => {
        return {data: dispatchHostAction(dispatch, getRHSPluginActions()?.toggleRHSPlugin)};
    };
};

// Switches the RHS to another connected Jira instance. The issue list resets to
// the default tab because status tabs differ between instances.
export const selectRHSInstance = (instanceID: string) => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const rhs = getState()[pluginStateKey].rhs;
        if (rhs.instanceID === instanceID) {
            return {data: false};
        }
        dispatch({
            type: ActionTypes.SET_RHS_VIEW,
            data: {
                instanceID,
                tab: RHS_DEFAULT_TAB,
                sort: rhs.sort,
            },
        });
        persistCurrentRHSView(getState());
        return {data: true};
    };
};

// Starts the /jira setup wizard for a system admin; the plugin bot continues
// the flow in a direct message.
export const startJiraSetupWizard = (channelId: string, teamId: string) => {
    return async () => {
        try {
            const data = await doFetch('/api/v4/commands/execute', {
                method: 'post',
                body: JSON.stringify({
                    command: '/jira setup',
                    channel_id: channelId,
                    team_id: teamId,
                }),
            });
            return {data};
        } catch (error) {
            return {error};
        }
    };
};
