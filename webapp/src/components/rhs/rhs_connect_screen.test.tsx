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

    test('the desktop app says the sign-in opens in the browser', () => {
        (window as unknown as {desktop?: unknown}).desktop = {version: '5.12.0'};
        expect(isMattermostDesktop()).toBe(true);
        render(
            <RHSConnectScreen
                instances={instances}
                onConnect={jest.fn()}
            />,
        );
        expect(screen.getByTestId('rhs-connect-desktop-hint')).toHaveTextContent('Вход откроется в браузере компьютера');
    });
});

describe('connecting from the desktop app', () => {
    const {rhsConnectNext} = jest.requireActual('./rhs_connect_complete');

    test('only the plugin OAuth callback is followed after signing in', () => {
        const callback = '/plugins/jira/instance/aHR0cHM6Ly9qaXJh/oauth1/complete.html?oauth_token=t&oauth_verifier=v';
        expect(rhsConnectNext(callback)).toBe(callback);
        for (const bad of [
            null,
            '',
            'https://evil.example.com/plugins/jira/instance/x/oauth1/complete.html',
            '//evil.example.com/plugins/jira/instance/x/oauth1/complete.html',
            '/plugins/jira/instance/x/../../../logout',
            '/plugins/other/instance/x/oauth1/complete.html',
            '/plugins/jira/instance/x/user/connect',
            '/\\evil.example.com/plugins/jira/instance/x/oauth1/complete.html',
        ]) {
            expect(rhsConnectNext(bad)).toBe('');
        }
    });

    test('the sign-in address from the plugin opens in the system browser', async () => {
        const {openConnectInBrowser} = jest.requireActual('../../actions/rhs_connect');
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        const fetchMock = jest.fn(async () => ({ok: true, json: async () => ({url: 'https://jira.example.com/plugins/servlet/oauth/authorize?oauth_token=t'})}));
        (global as unknown as {fetch: unknown}).fetch = fetchMock;
        await expect(openConnectInBrowser('/plugins/jira', 'https://jira.example.com')).resolves.toBe(true);
        expect(open).toHaveBeenCalledWith('https://jira.example.com/plugins/servlet/oauth/authorize?oauth_token=t', '_blank');

        // Cloud and errors connect in the app as before.
        open.mockClear();
        (global as unknown as {fetch: unknown}).fetch = jest.fn(async () => ({ok: false, status: 400, text: async () => '{"error":"unsupported_instance"}'}));
        await expect(openConnectInBrowser('/plugins/jira', 'https://x.atlassian.net')).resolves.toBe(false);
        expect(open).not.toHaveBeenCalled();
        open.mockRestore();
    });
});
