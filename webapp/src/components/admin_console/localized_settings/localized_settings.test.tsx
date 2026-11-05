// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import manifest from '../../../manifest';

import JiraAdminPanel, {maskWebhookSecret} from './jira_admin_panel';
import LocalizedSetting, {generateSecret, renderInlineText, settingValue} from './localized_setting';
import {LOCALIZED_SETTINGS, settingLanguage} from './settings_text';

function descriptor(key: string) {
    return LOCALIZED_SETTINGS.find((d) => d.key === key)!;
}

describe('settingLanguage', () => {
    test('only Russian is translated', () => {
        expect(settingLanguage('ru')).toBe('ru');
        expect(settingLanguage('en')).toBe('en');
        expect(settingLanguage('de')).toBe('en');
        expect(settingLanguage('')).toBe('en');
    });
});

describe('LOCALIZED_SETTINGS', () => {
    test('covers every setting of the manifest', () => {
        const fromManifest = (manifest as any).settings_schema.settings.map((s: {key: string}) => s.key).filter((k: string) => k !== 'JiraAdminPanel'); // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(LOCALIZED_SETTINGS.map((d) => d.key).sort()).toEqual([...fromManifest].sort());
    });

    test('has both languages for every text', () => {
        LOCALIZED_SETTINGS.forEach((d) => {
            expect(d.label.ru && d.label.en && d.help.ru && d.help.en).toBeTruthy();
            (d.options || []).forEach((o) => expect(o.label.ru && o.label.en).toBeTruthy());
        });
    });
});

describe('LocalizedSetting', () => {
    test('shows the text in the language of the user', () => {
        const {rerender} = render(
            <LocalizedSetting
                id='EnableJiraRHS'
                value={true}
                onChange={jest.fn()}
                language='ru'
                descriptor={descriptor('EnableJiraRHS')}
            />,
        );
        expect(screen.getByText('Показывать задачи Jira в правой боковой панели:')).toBeTruthy();
        expect(screen.getByTestId('EnableJiraRHS-true').parentElement?.textContent).toBe('Да');

        rerender(
            <LocalizedSetting
                id='EnableJiraRHS'
                value={true}
                onChange={jest.fn()}
                language='en'
                descriptor={descriptor('EnableJiraRHS')}
            />,
        );
        expect(screen.getByText('Show Jira tickets in the right-hand sidebar:')).toBeTruthy();
    });

    test('a bool setting reports booleans and asks to save', () => {
        const onChange = jest.fn();
        const setSaveNeeded = jest.fn();
        render(
            <LocalizedSetting
                id='EnableJiraRHS'
                value={false}
                onChange={onChange}
                setSaveNeeded={setSaveNeeded}
                language='ru'
                descriptor={descriptor('EnableJiraRHS')}
            />,
        );
        fireEvent.click(screen.getByTestId('EnableJiraRHS-true'));
        expect(onChange).toHaveBeenCalledWith('EnableJiraRHS', true);
        expect(setSaveNeeded).toHaveBeenCalled();
    });

    test('a radio setting keeps the option values', () => {
        const onChange = jest.fn();
        render(
            <LocalizedSetting
                id='RolesAllowedToEditJiraSubscriptions'
                value='system_admin'
                onChange={onChange}
                language='ru'
                descriptor={descriptor('RolesAllowedToEditJiraSubscriptions')}
            />,
        );
        expect((screen.getByTestId('RolesAllowedToEditJiraSubscriptions-system_admin') as HTMLInputElement).checked).toBe(true);
        fireEvent.click(screen.getByTestId('RolesAllowedToEditJiraSubscriptions-channel_admin'));
        expect(onChange).toHaveBeenCalledWith('RolesAllowedToEditJiraSubscriptions', 'channel_admin');
    });

    test('a generated setting only changes through the button', () => {
        const onChange = jest.fn();
        render(
            <LocalizedSetting
                id='secret'
                value='********'
                onChange={onChange}
                language='ru'
                descriptor={descriptor('secret')}
            />,
        );
        expect((screen.getByTestId('secret-input') as HTMLInputElement).disabled).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('secret-regenerate'));
        const [id, value] = onChange.mock.calls[0];
        expect(id).toBe('secret');
        expect(value).toMatch(/^[\w-]{32}$/);
    });

    test('a setting from the environment cannot be changed', () => {
        render(
            <LocalizedSetting
                id='EnableJiraRHS'
                value={false}
                setByEnv={true}
                onChange={jest.fn()}
                language='ru'
                descriptor={descriptor('EnableJiraRHS')}
            />,
        );
        expect((screen.getByTestId('EnableJiraRHS-true') as HTMLInputElement).disabled).toBe(true);
    });
});

describe('settingValue', () => {
    const roles = descriptor('RolesAllowedToEditJiraSubscriptions');
    const stored = (value: unknown) => ({PluginSettings: {Plugins: {jira: {RolesAllowedToEditJiraSubscriptions: value}}}});

    test('the value of the page comes first', () => {
        expect(settingValue({value: 'users', config: stored('team_admin'), descriptor: roles})).toBe('users');
        expect(settingValue({value: false, descriptor: descriptor('EnableJiraRHS')})).toBe(false);
    });

    test('then the key as the manifest spells it, then the default', () => {
        expect(settingValue({config: stored('team_admin'), descriptor: roles})).toBe('team_admin');
        expect(settingValue({config: {}, descriptor: roles})).toBe('system_admin');
        expect(settingValue({descriptor: descriptor('EnableAutocomplete')})).toBe(true);
    });

    test('a saved key is shown masked, never replaced by a default', () => {
        const key = descriptor('EncryptionKey');
        const config = {PluginSettings: {Plugins: {jira: {EncryptionKey: '********'}}}};
        expect(settingValue({config, descriptor: key})).toBe('********');
    });
});

describe('helpers', () => {
    test('generated secrets differ', () => {
        expect(generateSecret()).not.toBe(generateSecret());
    });

    test('inline markup becomes elements and never HTML', () => {
        render(<div data-testid='t'>{renderInlineText('**жирно** и [ссылка](https://x.example) `код` <img>')}</div>);
        expect(screen.getByText('жирно').tagName).toBe('B');
        expect(screen.getByRole('link').getAttribute('href')).toBe('https://x.example');
        expect(screen.getByText('код').tagName).toBe('CODE');
        expect(screen.getByTestId('t').querySelector('img')).toBeNull();
    });

    test('the webhook secret is masked', () => {
        expect(maskWebhookSecret('http://x/webhook?a=1&secret=abc')).toBe('http://x/webhook?a=1&secret=•••');
    });
});

describe('JiraAdminPanel', () => {
    const settings = {
        plugin_version: '4.6.0',
        instances: [{instance_id: 'http://jira', type: 'server', webhook_url: 'http://mm/webhook?secret=abc'}],
    };

    test('shows the instance, masks the webhook and copies it whole', async () => {
        const writeText = jest.fn(async () => null);
        Object.assign(navigator, {clipboard: {writeText}});
        render(
            <JiraAdminPanel
                language='ru'
                loadAdmin={async () => settings}
                startSetup={async () => ({})}
            />,
        );
        expect((await screen.findByTestId('jira-admin-instance')).textContent).toBe('http://jira (Data Center)');
        expect(screen.getByTestId('jira-admin-webhook').textContent).not.toContain('abc');
        fireEvent.click(screen.getByTestId('jira-admin-copy-webhook'));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://mm/webhook?secret=abc'));
        expect(screen.getByTestId('jira-admin-version').textContent).toBe('4.6.0');
    });

    test('starts the wizard and reports a failure', async () => {
        const startSetup = jest.fn(async () => {
            throw new Error('no');
        });
        render(
            <JiraAdminPanel
                language='ru'
                loadAdmin={async () => settings}
                startSetup={startSetup}
            />,
        );
        fireEvent.click(await screen.findByTestId('jira-admin-wizard'));
        expect(await screen.findByText('Не удалось запустить мастер.')).toBeTruthy();
    });

    test('says when the data cannot be loaded', async () => {
        render(
            <JiraAdminPanel
                language='en'
                loadAdmin={async () => {
                    throw new Error('no');
                }}
                startSetup={async () => ({})}
            />,
        );
        expect((await screen.findByTestId('jira-admin-failed')).textContent).toContain('Failed to load');
    });
});
