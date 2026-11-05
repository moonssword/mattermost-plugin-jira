// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import RHSAvatar from './rhs_avatar';

describe('components/rhs/rhs_avatar', () => {
    test('initials without a picture', () => {
        const {container} = render(<RHSAvatar name='Дмитрий Козлов'/>);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('ДК')).toBeTruthy();
    });

    test('a picture, and initials when it does not load', () => {
        const {container} = render(
            <RHSAvatar
                name='Дмитрий Козлов'
                url='/plugins/jira/api/v2/rhs/icon?path=x'
            />,
        );
        const img = container.querySelector('img') as HTMLImageElement;
        expect(img.getAttribute('src')).toBe('/plugins/jira/api/v2/rhs/icon?path=x');
        fireEvent.error(img);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('ДК')).toBeTruthy();
    });
});
