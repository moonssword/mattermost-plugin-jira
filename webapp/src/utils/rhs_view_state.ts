// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    RHSSort,
    RHSViewState,
    RHS_DEFAULT_FILTER,
    isRHSFilter,
} from 'types/rhs';

const storagePrefix = 'jira:rhs-view:';

export function rhsViewStorageKey(userId: string): string {
    return storagePrefix + userId;
}

function isRHSSort(value: unknown): value is RHSSort {
    return value === 'updated' || value === 'created';
}

// Older versions stored a status tab instead of a filter; such entries keep
// their instance and sort and fall back to the default filter.
export function validateRHSViewState(raw: unknown): RHSViewState | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const candidate = raw as {instance?: unknown; filter?: unknown; sort?: unknown};
    if (typeof candidate.instance !== 'string' || !candidate.instance) {
        return null;
    }
    if (!isRHSSort(candidate.sort)) {
        return null;
    }

    return {
        instance: candidate.instance,
        filter: isRHSFilter(candidate.filter) ? candidate.filter : RHS_DEFAULT_FILTER,
        sort: candidate.sort,
    };
}

export function loadRHSViewState(userId: string): RHSViewState | null {
    if (!userId) {
        return null;
    }

    try {
        const raw = localStorage.getItem(rhsViewStorageKey(userId));
        if (!raw) {
            return null;
        }
        return validateRHSViewState(JSON.parse(raw));
    } catch {
        // ignore quota / private-mode / corrupt JSON
        return null;
    }
}

export function saveRHSViewState(userId: string, view: RHSViewState): void {
    if (!userId) {
        return;
    }

    try {
        localStorage.setItem(rhsViewStorageKey(userId), JSON.stringify(view));
    } catch {
        // ignore quota / private-mode
    }
}
