// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// jqlFieldName is the name Jira's JQL suggestions know a field by: the
// system name ("labels") or cf[id] for a custom field. The display name, the
// one passed before, is translated in Jira and then nothing was suggested.
export function jqlFieldName(key: string, schema?: {system?: string}, displayName = ''): string {
    if (schema?.system) {
        return schema.system;
    }
    const custom = key.match(/^customfield_(\d+)$/);
    if (custom) {
        return 'cf[' + custom[1] + ']';
    }
    return displayName || key;
}
