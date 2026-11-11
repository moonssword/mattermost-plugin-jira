// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// isMattermostDesktop tells the Mattermost desktop app from a browser. Its
// sign-in window has no cookies of the browser, and a Jira behind single
// sign-on (ADFS with Windows sign-in) may leave it blank.
export function isMattermostDesktop(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    if ((window as unknown as {desktop?: unknown}).desktop) {
        return true;
    }
    const agent = window.navigator?.userAgent || '';
    return agent.includes('Electron') && agent.includes('Mattermost');
}
