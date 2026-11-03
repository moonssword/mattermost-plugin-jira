// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSNotificationRole, RHSSettings} from 'types/rhs_settings';

import {rhsRequest} from './rhs';

import {buildQueryString} from './index';

export function getRHSSettings(baseUrl: string, instanceID: string): Promise<RHSSettings> {
    return rhsRequest<RHSSettings>(`${baseUrl}/api/v2/rhs/settings${buildQueryString({instance_id: instanceID})}`);
}

export function setRHSNotification(baseUrl: string, instanceID: string, role: RHSNotificationRole, enabled: boolean): Promise<RHSSettings> {
    return rhsRequest<RHSSettings>(`${baseUrl}/api/v2/rhs/settings/notifications`, {
        method: 'post',
        body: JSON.stringify({instance_id: instanceID, role, enabled}),
    });
}
