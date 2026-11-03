// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Holds the host's show/hide/toggle actions for the Jira RHS. They are only
// known after registration, and actions outside the RHS component (post menu,
// channel header) need them to open the panel.
export type RHSPluginActions = {
    showRHSPlugin: unknown;
    hideRHSPlugin: unknown;
    toggleRHSPlugin: unknown;
};

let pluginActions: RHSPluginActions | null = null;

function isRHSPluginActions(value: unknown): value is RHSPluginActions {
    return Boolean(value) && typeof value === 'object' &&
        'showRHSPlugin' in (value as object) &&
        'toggleRHSPlugin' in (value as object);
}

export function setRHSPluginActions(value: unknown): boolean {
    if (!isRHSPluginActions(value)) {
        return false;
    }
    pluginActions = value;
    return true;
}

export function getRHSPluginActions(): RHSPluginActions | null {
    return pluginActions;
}

export function resetRHSPluginActions(): void {
    pluginActions = null;
}
