// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSUser} from './rhs_issue';

// Personal DM notification kinds, as the server names them.
export type RHSNotificationRole = 'assignee' | 'mention' | 'reporter' | 'watching';

export const RHS_NOTIFICATION_ROLES: RHSNotificationRole[] = ['assignee', 'mention', 'reporter', 'watching'];

export type RHSSettings = {
    account: RHSUser;
    notifications: {[role in RHSNotificationRole]?: boolean};
    plugin_version: string;
};
