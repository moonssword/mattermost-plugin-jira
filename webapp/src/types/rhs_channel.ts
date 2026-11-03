// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelSubscription} from './model';

export type RHSChannelSubscription = ChannelSubscription & {
    paused?: boolean;
    paused_at?: number;
    paused_by?: string;
    paused_by_name?: string;
};

export type RHSChannelSubscriptions = {
    subscriptions: RHSChannelSubscription[];

    // Whether the user may create, edit, pause and delete subscriptions here.
    can_manage: boolean;
};
