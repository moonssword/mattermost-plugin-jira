// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {RHSConnectScreen} from './rhs_connect_screen';
import {isMattermostDesktop} from './rhs_desktop';

describe('RHSConnectScreen in the desktop app', () => {
    const instances = [{instance_id: 'https://jira.example.com', type: 'server'}] as never;

    afterEach(() => {
        delete (window as unknown as {desktop?: unknown}).desktop;
    });

    test('a browser gets no desktop hint', () => {
        expect(isMattermostDesktop()).toBe(false);
        render(
            <RHSConnectScreen
                instances={instances}
                onConnect={jest.fn()}
            />,
        );
        expect(screen.queryByTestId('rhs-connect-desktop-hint')).toBeNull();
    });

    test('the desktop app suggests connecting from a browser', () => {
        (window as unknown as {desktop?: unknown}).desktop = {version: '5.12.0'};
        expect(isMattermostDesktop()).toBe(true);
        render(
            <RHSConnectScreen
                instances={instances}
                onConnect={jest.fn()}
            />,
        );
        expect(screen.getByTestId('rhs-connect-desktop-hint')).toHaveTextContent('подключитесь из браузера');
    });
});
