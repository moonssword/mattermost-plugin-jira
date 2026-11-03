// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Instance, InstanceType} from 'types/model';

import {RHS_STRINGS} from './rhs_strings';

// rhsInstanceHost turns "https://jira.example.com/" into "jira.example.com".
export function rhsInstanceHost(instanceID: string): string {
    try {
        const url = new URL(instanceID);
        return url.host + url.pathname.replace(/\/+$/, '');
    } catch {
        return instanceID;
    }
}

export function rhsInstanceName(instance: Instance): string {
    return instance.alias || rhsInstanceHost(instance.instance_id);
}

export function rhsInstanceKind(instance: Instance): string {
    return instance.type === InstanceType.SERVER ? RHS_STRINGS.instanceServer : RHS_STRINGS.instanceCloud;
}

export function rhsInstanceOptionLabel(instance: Instance): string {
    return rhsInstanceName(instance) + ' (' + rhsInstanceKind(instance) + ')';
}
