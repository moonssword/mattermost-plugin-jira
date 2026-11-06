// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import AttachmentTiles, {RHS_ATTACHMENTS_COLLAPSED, formatRHSFileSize} from './attachments';

const files = (count: number) => Array.from({length: count}, (_, i) => ({
    id: String(i),
    name: 'file' + i + '.pdf',
    url: '/plugins/jira/api/v2/rhs/attachment?id=' + i + '&name=file' + i + '.pdf',
    image: false,
    size: 2048,
    created: '2026-11-06T10:00:00Z',
}));

describe('AttachmentTiles', () => {
    test('shows the first tiles and all of them on request', () => {
        render(
            <AttachmentTiles
                attachments={files(RHS_ATTACHMENTS_COLLAPSED + 2)}
                nowMs={Date.parse('2026-11-06T11:00:00Z')}
            />,
        );
        expect(screen.getAllByTestId('rhs-attachment-tile')).toHaveLength(RHS_ATTACHMENTS_COLLAPSED);
        fireEvent.click(screen.getByTestId('rhs-attachments-toggle'));
        expect(screen.getAllByTestId('rhs-attachment-tile')).toHaveLength(RHS_ATTACHMENTS_COLLAPSED + 2);
        fireEvent.click(screen.getByTestId('rhs-attachments-toggle'));
        expect(screen.getAllByTestId('rhs-attachment-tile')).toHaveLength(RHS_ATTACHMENTS_COLLAPSED);
    });

    test('has no toggle when everything fits', () => {
        render(
            <AttachmentTiles
                attachments={files(RHS_ATTACHMENTS_COLLAPSED)}
                nowMs={0}
            />,
        );
        expect(screen.queryByTestId('rhs-attachments-toggle')).toBeNull();
        expect(screen.getAllByText('PDF')).toHaveLength(RHS_ATTACHMENTS_COLLAPSED);
    });

    test('renders nothing without files', () => {
        const {container} = render(
            <AttachmentTiles
                attachments={[]}
                nowMs={0}
            />,
        );
        expect(container.firstChild).toBeNull();
    });
});

describe('formatRHSFileSize', () => {
    test('picks the unit', () => {
        expect(formatRHSFileSize(0)).toBe('');
        expect(formatRHSFileSize(512)).toBe('512 Б');
        expect(formatRHSFileSize(2048)).toBe('2 КБ');
        expect(formatRHSFileSize(1572864)).toBe('1.5 МБ');
        expect(formatRHSFileSize(20971520)).toBe('20 МБ');
    });
});
