// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSChannelSubscriptions} from 'types/rhs_channel';

import {rhsRequest} from './rhs';

import {buildQueryString} from './index';

export function getRHSChannelSubscriptions(baseUrl: string, instanceID: string, channelID: string): Promise<RHSChannelSubscriptions> {
    return rhsRequest<RHSChannelSubscriptions>(`${baseUrl}/api/v2/rhs/channel/subscriptions${buildQueryString({instance_id: instanceID, channel_id: channelID})}`);
}

export function pauseRHSSubscription(baseUrl: string, instanceID: string, channelID: string, subscriptionID: string, paused: boolean): Promise<RHSChannelSubscriptions> {
    return rhsRequest<RHSChannelSubscriptions>(`${baseUrl}/api/v2/rhs/channel/subscription/pause`, {
        method: 'post',
        body: JSON.stringify({instance_id: instanceID, channel_id: channelID, subscription_id: subscriptionID, paused}),
    });
}
