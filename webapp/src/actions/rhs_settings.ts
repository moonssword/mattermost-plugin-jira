// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {RHSFetchError} from '../client/rhs';
import {getRHSSettings, setRHSNotification} from '../client/rhs_settings';
import {getPluginServerRoute, getRHSActiveInstanceID} from '../selectors';

import {RHSNotificationRole, RHSSettings} from 'types/rhs_settings';
import {GlobalState} from 'types/store';

type Result = Promise<{data?: RHSSettings; error?: RHSFetchError}>;

function asError(error: unknown): RHSFetchError {
    return error instanceof RHSFetchError ? error : new RHSFetchError('internal_error', String(error), 0);
}

export const openRHSSettings = () => ({type: ActionTypes.OPEN_RHS_SETTINGS});

export const closeRHSSettings = () => ({type: ActionTypes.CLOSE_RHS_SETTINGS});

export const loadRHSSettings = () => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Result => {
        const state = getState();
        try {
            return {data: await getRHSSettings(getPluginServerRoute(state), getRHSActiveInstanceID(state))};
        } catch (error) {
            return {error: asError(error)};
        }
    };
};

export const setRHSNotificationRole = (role: RHSNotificationRole, enabled: boolean) => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Result => {
        const state = getState();
        try {
            return {data: await setRHSNotification(getPluginServerRoute(state), getRHSActiveInstanceID(state), role, enabled)};
        } catch (error) {
            return {error: asError(error)};
        }
    };
};
