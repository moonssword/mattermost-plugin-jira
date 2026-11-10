// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from '../manifest';

// The Jira paths the plugin's icon route serves; it refuses anything else.
const ICON_PREFIXES = ['/images/icons/', '/rest/api/2/universal_avatar/'];
const ICON_PATHS = ['/secure/viewavatar', '/secure/projectavatar', '/secure/useravatar'];

function isIconPath(path: string): boolean {
    return ICON_PATHS.includes(path) || ICON_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// jiraImageURL sends a picture from Jira Server / Data Center (priority and
// issue type icons, avatars) through the plugin server. Loaded straight from
// Jira, the browser reached into the company network from the Mattermost
// page, and Chrome asked for access to the local network. Pictures from
// elsewhere, Jira Cloud's included, stay as they are.
export function jiraImageURL(raw: string | undefined, instanceID: string | undefined): string {
    if (!raw || !instanceID) {
        return raw || '';
    }
    let picture: URL;
    let instance: URL;
    try {
        picture = new URL(raw);
        instance = new URL(instanceID);
    } catch (error) {
        return raw;
    }
    if (picture.origin !== instance.origin || instance.hostname.endsWith('.atlassian.net')) {
        return raw;
    }
    const base = instance.pathname.replace(/\/+$/, '');
    if (base && !picture.pathname.startsWith(base + '/')) {
        return raw;
    }
    const path = picture.pathname.slice(base.length);
    if (!isIconPath(path)) {
        return raw;
    }
    const basename = ((window as unknown as {basename?: string}).basename || '').replace(/\/+$/, '');
    const query = new URLSearchParams({instance_id: instanceID, path: path + picture.search});
    return `${basename}/plugins/${manifest.id}/api/v2/rhs/icon?${query.toString()}`;
}
