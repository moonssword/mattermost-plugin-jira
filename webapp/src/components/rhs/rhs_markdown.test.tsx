// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {splitRHSMarkdown} from './rhs_markdown';

describe('splitRHSMarkdown', () => {
    const url = '/plugins/jira/api/v2/rhs/attachment?id=1&key=K-1';

    test('takes out attached pictures only', () => {
        expect(splitRHSMarkdown('до\n![a.png](' + url + ')\nпосле ![b](https://example.com/b.png)')).toEqual([
            {kind: 'text', text: 'до\n'},
            {kind: 'image', alt: 'a.png', url},
            {kind: 'text', text: '\nпосле ![b](https://example.com/b.png)'},
        ]);
    });

    test('leaves plain text alone', () => {
        expect(splitRHSMarkdown('текст')).toEqual([{kind: 'text', text: 'текст'}]);
    });
});
