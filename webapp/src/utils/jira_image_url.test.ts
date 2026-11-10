// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {jiraImageURL} from './jira_image_url';

describe('jiraImageURL', () => {
    const jira = 'https://jira.example.com';

    test('Jira icons and avatars go through the plugin server', () => {
        expect(jiraImageURL(jira + '/images/icons/priorities/high.svg', jira))
            .toBe('/plugins/jira/api/v2/rhs/icon?instance_id=https%3A%2F%2Fjira.example.com&path=%2Fimages%2Ficons%2Fpriorities%2Fhigh.svg');
        expect(jiraImageURL(jira + '/secure/useravatar?size=small&ownerId=anna', jira))
            .toContain('path=%2Fsecure%2Fuseravatar%3Fsize%3Dsmall%26ownerId%3Danna');
    });

    test('a Jira under a path keeps the path out of the icon path', () => {
        expect(jiraImageURL('https://corp.example.com/jira/secure/viewavatar?avatarId=1', 'https://corp.example.com/jira'))
            .toContain('path=%2Fsecure%2Fviewavatar%3FavatarId%3D1');
    });

    test('anything else stays as it is', () => {
        expect(jiraImageURL('https://www.gravatar.com/avatar/x', jira)).toBe('https://www.gravatar.com/avatar/x');
        expect(jiraImageURL(jira + '/secure/attachment/1/a.png', jira)).toBe(jira + '/secure/attachment/1/a.png');
        expect(jiraImageURL('https://x.atlassian.net/images/icons/a.svg', 'https://x.atlassian.net')).toBe('https://x.atlassian.net/images/icons/a.svg');
        expect(jiraImageURL('', jira)).toBe('');
        expect(jiraImageURL(jira + '/images/icons/a.svg', '')).toBe(jira + '/images/icons/a.svg');
    });
});
