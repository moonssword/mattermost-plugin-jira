// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    isRHSViewable,
    openRHSViewer,
    rhsAttachmentNameFromURL,
    rhsFileExtension,
} from './rhs_viewer';

describe('rhs_viewer', () => {
    test('knows what the viewer can show', () => {
        expect(isRHSViewable('a.PDF')).toBe(true);
        expect(isRHSViewable('a.png')).toBe(true);
        expect(isRHSViewable('a.log')).toBe(true);
        expect(isRHSViewable('a.docx')).toBe(false);
        expect(isRHSViewable('a.csv')).toBe(false);
        expect(isRHSViewable('no-extension')).toBe(false);
        expect(rhsFileExtension('a.tar.GZ')).toBe('gz');
    });

    test('reads the file name from an attachment address only', () => {
        expect(rhsAttachmentNameFromURL('/plugins/jira/api/v2/rhs/attachment?id=1&key=K-1&name=%D0%BE%D1%82%D1%87%D1%91%D1%82+1.pdf')).toBe('отчёт 1.pdf');
        expect(rhsAttachmentNameFromURL('https://example.com/a?name=b.pdf')).toBe('');
        expect(rhsAttachmentNameFromURL('/plugins/jira/api/v2/rhs/attachment?id=1')).toBe('');
    });

    test('reports that the viewer is unavailable, so the link is followed', () => {
        expect(openRHSViewer([{name: 'a.pdf', url: '/a'}])).toBe(false);
        (window as unknown as {store: object}).store = {
            getState: () => ({}),
            dispatch: jest.fn(),
            subscribe: jest.fn(),
        };
        expect(openRHSViewer([{name: 'a.pdf', url: '/a'}])).toBe(false);
        delete (window as unknown as {store?: object}).store;
    });
});
