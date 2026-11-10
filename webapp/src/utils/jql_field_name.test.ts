// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {jqlFieldName} from './jql_field_name';

describe('jqlFieldName', () => {
    test('system and custom fields by the names JQL knows', () => {
        expect(jqlFieldName('labels', {system: 'labels'}, 'Метки')).toBe('labels');
        expect(jqlFieldName('customfield_10100', {}, 'Теги')).toBe('cf[10100]');
        expect(jqlFieldName('other', {}, 'Other')).toBe('Other');
    });
});
