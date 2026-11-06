// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    rhsFileName,
    rhsFileReference,
    rhsInsertAtCursor,
    rhsPastedFileName,
} from './rhs_files';

describe('rhs_files', () => {
    test('names are safe for wiki references', () => {
        expect(rhsFileName('a!b|c[1].png')).toBe('a_b_c_1_.png');
        expect(rhsFileName(' ')).toBe('file');
    });

    test('pictures are embedded, other files linked', () => {
        expect(rhsFileReference('a.PNG')).toBe('!a.PNG|thumbnail!');
        expect(rhsFileReference('a.pdf')).toBe('[^a.pdf]');
    });

    test('clipboard screenshots get their own names', () => {
        const now = new Date(2026, 10, 6, 9, 5, 7);
        const shot = new File(['x'], 'image.png', {type: 'image/png'});
        expect(rhsPastedFileName(shot, now, 0)).toBe('screenshot-20261106-090507.png');
        expect(rhsPastedFileName(shot, now, 2)).toBe('screenshot-20261106-090507-2.png');
        expect(rhsPastedFileName(new File(['x'], 'plan.pdf'), now, 0)).toBe('plan.pdf');
    });

    test('a reference goes on its own line', () => {
        expect(rhsInsertAtCursor('до', 2, 2, '!a!')).toEqual({text: 'до\n!a!\n', cursor: 7});
        expect(rhsInsertAtCursor('', 0, 0, '!a!')).toEqual({text: '!a!\n', cursor: 4});
    });
});
