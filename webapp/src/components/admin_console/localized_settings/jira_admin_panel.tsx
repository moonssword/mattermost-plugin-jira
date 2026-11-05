// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {ADMIN_TEXT, SettingLanguage} from './settings_text';
import {HelpText} from './localized_setting';

export type RHSAdminInstance = {
    instance_id: string;
    alias?: string;
    type: string;
    webhook_url: string;
};

export type RHSAdminSettings = {
    instances: RHSAdminInstance[];
    plugin_version: string;
};

export type Props = {
    language: SettingLanguage;
    loadAdmin: () => Promise<RHSAdminSettings>;
    startSetup: () => Promise<unknown>;
};

// maskWebhookSecret hides the secret in the shown URL; copying uses the full one.
export function maskWebhookSecret(url: string): string {
    return url.replace(/([?&]secret=)[^&]*/, '$1•••');
}

function Row(props: {label: string; children: React.ReactNode}): JSX.Element {
    return (
        <div className='form-group'>
            <label className='control-label col-sm-4'>{props.label}</label>
            <div className='col-sm-8'>{props.children}</div>
        </div>
    );
}

// JiraAdminPanel is the System Console block with what only system admins
// use: the instances, the webhook URL and the setup wizard.
export default function JiraAdminPanel(props: Props): JSX.Element {
    const {language} = props;
    const [settings, setSettings] = useState<RHSAdminSettings | null>(null);
    const [failed, setFailed] = useState(false);
    const [copiedID, setCopiedID] = useState('');
    const [wizard, setWizard] = useState<'' | 'started' | 'failed'>('');

    useEffect(() => {
        let active = true;
        props.loadAdmin().then((data) => {
            if (active) {
                setSettings(data);
            }
        }).catch(() => {
            if (active) {
                setFailed(true);
            }
        });
        return () => {
            active = false;
        };

    // Loaded once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const copy = async (instance: RHSAdminInstance) => {
        try {
            await navigator.clipboard.writeText(instance.webhook_url);
            setCopiedID(instance.instance_id);
        } catch {
            setCopiedID('');
        }
    };

    const runWizard = async () => {
        try {
            await props.startSetup();
            setWizard('started');
        } catch {
            setWizard('failed');
        }
    };

    if (failed) {
        return (
            <div
                className='alert alert-warning'
                data-testid='jira-admin-failed'
            >
                {ADMIN_TEXT.loadFailed[language]}
            </div>
        );
    }

    const instances = settings?.instances || [];
    return (
        <div data-testid='jira-admin-panel'>
            <div className='form-group'>
                <div className='col-sm-12'>
                    <HelpText text={ADMIN_TEXT.docs[language]}/>
                </div>
            </div>
            <Row label={ADMIN_TEXT.instances[language]}>
                {settings && instances.length === 0 && <div>{ADMIN_TEXT.noInstances[language]}</div>}
                {instances.map((instance) => (
                    <div
                        key={instance.instance_id}
                        data-testid='jira-admin-instance'
                    >
                        {(instance.alias || instance.instance_id) + ' (' + (instance.type === 'server' ? ADMIN_TEXT.dataCenter[language] : ADMIN_TEXT.cloud[language]) + ')'}
                    </div>
                ))}
                <HelpText text={ADMIN_TEXT.instancesHelp[language]}/>
            </Row>
            <Row label={ADMIN_TEXT.webhook[language]}>
                {instances.map((instance) => (
                    <div
                        className='jira-admin-webhook'
                        key={instance.instance_id}
                    >
                        <code data-testid='jira-admin-webhook'>{maskWebhookSecret(instance.webhook_url)}</code>
                        {' '}
                        <button
                            type='button'
                            className='btn btn-tertiary btn-sm'
                            data-testid='jira-admin-copy-webhook'
                            onClick={() => copy(instance)}
                        >
                            {copiedID === instance.instance_id ? ADMIN_TEXT.copied[language] : ADMIN_TEXT.copy[language]}
                        </button>
                    </div>
                ))}
                <HelpText text={ADMIN_TEXT.webhookHelp[language]}/>
            </Row>
            <Row label={ADMIN_TEXT.wizard[language]}>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    data-testid='jira-admin-wizard'
                    onClick={runWizard}
                >
                    {ADMIN_TEXT.wizardRun[language]}
                </button>
                {wizard === 'started' && <HelpText text={ADMIN_TEXT.wizardStarted[language]}/>}
                {wizard === 'failed' && <HelpText text={ADMIN_TEXT.wizardFailed[language]}/>}
                <HelpText text={ADMIN_TEXT.wizardHelp[language]}/>
            </Row>
            {settings && (
                <Row label={ADMIN_TEXT.version[language]}>
                    <div data-testid='jira-admin-version'>{settings.plugin_version}</div>
                </Row>
            )}
        </div>
    );
}
