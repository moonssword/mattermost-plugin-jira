// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Instance} from 'types/model';
import {RHSTab, rhsTabIdentity} from 'types/rhs';

export function rhsTabsEqual(a: RHSTab, b: RHSTab): boolean {
    return rhsTabIdentity(a) === rhsTabIdentity(b);
}

export function resolveRHSInstanceID(
    savedInstanceID: string,
    connectedInstances: Instance[],
    defaultUserInstanceID: string,
): string {
    if (savedInstanceID && connectedInstances.some((instance) => instance.instance_id === savedInstanceID)) {
        return savedInstanceID;
    }
    if (defaultUserInstanceID && connectedInstances.some((instance) => instance.instance_id === defaultUserInstanceID)) {
        return defaultUserInstanceID;
    }
    if (connectedInstances.length >= 1) {
        return connectedInstances[0].instance_id;
    }
    return '';
}
