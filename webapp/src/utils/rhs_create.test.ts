// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {summaryFromMessage} from './rhs_create';

describe('rhs_create', () => {
    test('summaryFromMessage takes the first non-empty line without markdown', () => {
        expect(summaryFromMessage('\n\n**Экспорт CSV** возвращает 403\nподробности')).toBe('Экспорт CSV возвращает 403');
        expect(summaryFromMessage('> цитата из [лога](http://x)')).toBe('цитата из лога');
        expect(summaryFromMessage('- пункт списка')).toBe('пункт списка');
        expect(summaryFromMessage('')).toBe('');
    });

    test('summaryFromMessage cuts long text at a word boundary', () => {
        const long = 'слово '.repeat(40);
        const summary = summaryFromMessage(long, 50);
        expect(summary.length).toBeLessThanOrEqual(50);
        expect(summary.endsWith('слово…')).toBe(true);
    });
});
