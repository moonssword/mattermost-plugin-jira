// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {Instance, InstanceType} from 'types/model';
import {RHSSettings} from 'types/rhs_settings';

import {RHS_STRINGS} from '../rhs_strings';

import SettingsView, {Props, maskWebhookSecret} from './settings_view';

const dc: Instance = {instance_id: 'http://jira.example.com', type: InstanceType.SERVER};
const cloud: Instance = {instance_id: 'https://acme.atlassian.net', type: InstanceType.CLOUD};

const userSettings: RHSSettings = {
    account: {name: 'ivan', displayName: 'Иван Петров'},
    notifications: {assignee: true, mention: true, reporter: false, watching: true},
    plugin_version: '4.6.0',
};

const adminSettings: RHSSettings = {
    ...userSettings,
    admin: {
        instances: [{instance_id: dc.instance_id, type: 'server'}, {instance_id: cloud.instance_id, alias: 'acme', type: 'cloud'}],
        webhook_url: 'http://mm.example.com/plugins/jira/api/v2/webhook?secret=s3cr3t',
    },
};

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        activeInstance: dc,
        installedInstances: [dc],
        connectedInstances: [dc],
        defaultInstanceID: dc.instance_id,
        channelId: 'c1',
        teamId: 't1',
        adminConsoleURL: '/admin_console/plugins/plugin_jira',
        closeRHSSettings: jest.fn(),
        loadRHSSettings: jest.fn(async () => ({data: userSettings})),
        setRHSNotificationRole: jest.fn(async (role, enabled) => ({data: {...userSettings, notifications: {...userSettings.notifications, [role]: enabled}}})),
        disconnectUser: jest.fn(async () => ({})),
        handleConnectFlow: jest.fn(),
        startJiraSetupWizard: jest.fn(async () => ({data: {}})),
        ...overrides,
    };
}

describe('components/rhs/settings_view', () => {
    test('maskWebhookSecret hides only the secret', () => {
        expect(maskWebhookSecret('http://x/webhook?secret=abc&team=t')).toBe('http://x/webhook?secret=•••&team=t');
        expect(maskWebhookSecret('http://x/webhook')).toBe('http://x/webhook');
    });

    test('shows the account and notification switches, no admin block for users', async () => {
        render(<SettingsView {...makeProps()}/>);
        expect(await screen.findByTestId('rhs-settings-account')).toHaveTextContent('Иван Петров');
        expect(screen.getByText('jira.example.com · Data Center')).toBeInTheDocument();
        expect(screen.getByTestId('rhs-settings-notify-assignee')).toBeChecked();
        expect(screen.getByTestId('rhs-settings-notify-reporter')).not.toBeChecked();
        expect(screen.queryByTestId('rhs-settings-admin')).toBeNull();
        expect(screen.getByText('Версия плагина 4.6.0')).toBeInTheDocument();
    });

    test('a switch saves the role and shows the stored value', async () => {
        const props = makeProps();
        render(<SettingsView {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-settings-notify-reporter'));
        await waitFor(() => expect(screen.getByTestId('rhs-settings-notify-reporter')).toBeChecked());
        expect(props.setRHSNotificationRole).toHaveBeenCalledWith('reporter', true);
    });

    test('a failed save shows an error and keeps the old value', async () => {
        render(<SettingsView {...makeProps({setRHSNotificationRole: jest.fn(async () => ({error: new Error('x')}))})}/>);
        fireEvent.click(await screen.findByTestId('rhs-settings-notify-mention'));
        expect(await screen.findByText(RHS_STRINGS.settingsNotifyFailed)).toBeInTheDocument();
        expect(screen.getByTestId('rhs-settings-notify-mention')).toBeChecked();
    });

    test('disconnect asks first and closes the settings', async () => {
        const props = makeProps();
        render(<SettingsView {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-settings-disconnect'));
        expect(screen.getByRole('alertdialog')).toHaveTextContent('Отключить аккаунт Jira jira.example.com?');
        fireEvent.click(screen.getByTestId('rhs-settings-disconnect-confirm'));
        await waitFor(() => expect(props.closeRHSSettings).toHaveBeenCalled());
        expect(props.disconnectUser).toHaveBeenCalledWith(dc.instance_id);
    });

    test('other installed instances can be connected', async () => {
        const props = makeProps({installedInstances: [dc, cloud]});
        render(<SettingsView {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-settings-connect-' + cloud.instance_id));
        expect(props.handleConnectFlow).toHaveBeenCalledWith(cloud.instance_id);
    });

    test('admins see instances, a masked webhook URL to copy and the wizard', async () => {
        const writeText = jest.fn(async () => {
            // resolves when the text is copied
        });
        Object.assign(navigator, {clipboard: {writeText}});
        const props = makeProps({loadRHSSettings: jest.fn(async () => ({data: adminSettings}))});
        render(<SettingsView {...props}/>);

        const admin = await screen.findByTestId('rhs-settings-admin');
        expect(admin).toHaveTextContent('http://jira.example.com (Data Center) · по умолчанию');
        expect(admin).toHaveTextContent('acme (Cloud)');
        expect(screen.getByTestId('rhs-settings-webhook')).toHaveTextContent('secret=•••');
        expect(screen.getByTestId('rhs-settings-webhook')).not.toHaveTextContent('s3cr3t');

        fireEvent.click(screen.getByTestId('rhs-settings-copy-webhook'));
        await waitFor(() => expect(screen.getByTestId('rhs-settings-copy-webhook')).toHaveTextContent(RHS_STRINGS.settingsCopied));
        expect(writeText).toHaveBeenCalledWith(adminSettings.admin?.webhook_url);

        fireEvent.click(screen.getByTestId('rhs-settings-wizard'));
        expect(await screen.findByText(RHS_STRINGS.setupStarted)).toBeInTheDocument();
        expect(props.startJiraSetupWizard).toHaveBeenCalledWith('c1', 't1');
    });

    test('a load error offers a retry; back closes', async () => {
        const props = makeProps({loadRHSSettings: jest.fn(async () => ({error: new Error('x')}))});
        render(<SettingsView {...props}/>);
        expect(await screen.findByTestId('rhs-state-error')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('rhs-settings-back'));
        expect(props.closeRHSSettings).toHaveBeenCalled();
    });
});
