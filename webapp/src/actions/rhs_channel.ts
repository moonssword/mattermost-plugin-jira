// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {RHSFetchError} from '../client/rhs';
import {getRHSChannelSubscriptions, pauseRHSSubscription} from '../client/rhs_channel';
import {getPluginServerRoute, getRHSActiveInstanceID} from '../selectors';

import {RHSChannelSubscriptions} from 'types/rhs_channel';
import {GlobalState} from 'types/store';

type Result = Promise<{data?: RHSChannelSubscriptions; error?: RHSFetchError}>;

function asError(error: unknown): RHSFetchError {
    return error instanceof RHSFetchError ? error : new RHSFetchError('internal_error', String(error), 0);
}

// Subscriptions of a channel for the panel's active instance, with whether
// the user may manage them. Kept out of the store: only the section shows it.
export const loadRHSChannelSubscriptions = (channelID: string) => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Result => {
        const state = getState();
        try {
            return {data: await getRHSChannelSubscriptions(getPluginServerRoute(state), getRHSActiveInstanceID(state), channelID)};
        } catch (error) {
            return {error: asError(error)};
        }
    };
};

export const setRHSSubscriptionPaused = (channelID: string, subscriptionID: string, paused: boolean) => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Result => {
        const state = getState();
        try {
            return {data: await pauseRHSSubscription(getPluginServerRoute(state), getRHSActiveInstanceID(state), channelID, subscriptionID, paused)};
        } catch (error) {
            return {error: asError(error)};
        }
    };
};
