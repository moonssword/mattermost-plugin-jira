// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {Instance} from 'types/model';
import {RHSNotificationRole, RHSSettings, RHS_NOTIFICATION_ROLES} from 'types/rhs_settings';

import RHSAvatar from '../rhs_avatar';
import {rhsInstanceKind, rhsInstanceName} from '../rhs_instance_label';
import {RHSErrorState, RHSLoadingState} from '../rhs_states';
import {RHS_STRINGS} from '../rhs_strings';

type SettingsResult = Promise<{data?: RHSSettings; error?: unknown}>;

export type Props = {
    activeInstance: Instance | null;
    installedInstances: Instance[];
    connectedInstances: Instance[];
    defaultInstanceID: string;
    channelId: string;
    teamId: string;
    adminConsoleURL: string;
    closeRHSSettings: () => void;
    loadRHSSettings: () => SettingsResult;
    setRHSNotificationRole: (role: RHSNotificationRole, enabled: boolean) => SettingsResult;
    disconnectUser: (instanceID: string) => Promise<{error?: unknown}>;
    handleConnectFlow: (instanceID?: string) => void;
    startJiraSetupWizard: (channelId: string, teamId: string) => Promise<{data?: unknown; error?: unknown}>;
};

const ROLE_LABELS: Record<RHSNotificationRole, string> = {
    assignee: RHS_STRINGS.settingsNotifyAssignee,
    mention: RHS_STRINGS.settingsNotifyMention,
    reporter: RHS_STRINGS.settingsNotifyReporter,
    watching: RHS_STRINGS.settingsNotifyWatching,
};

// maskWebhookSecret hides the secret in the shown URL; copying uses the full one.
export function maskWebhookSecret(url: string): string {
    return url.replace(/([?&]secret=)[^&]*/, '$1•••');
}

function navigateInApp(url: string) {
    const history = (window as unknown as {WebappUtils?: {browserHistory?: {push: (path: string) => void}}}).WebappUtils?.browserHistory;
    if (history) {
        history.push(url);
        return;
    }
    window.location.assign(url);
}

// SettingsView gathers /jira me, disconnect, settings notifications and, for
// system admins, the instance list, webhook URL and setup wizard.
export default function SettingsView(props: Props): JSX.Element {
    const [settings, setSettings] = useState<RHSSettings | null>(null);
    const [failed, setFailed] = useState(false);
    const [savingRole, setSavingRole] = useState<RHSNotificationRole | ''>('');
    const [error, setError] = useState('');
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [wizard, setWizard] = useState<'' | 'started' | 'failed'>('');

    const load = async () => {
        setFailed(false);
        const result = await props.loadRHSSettings();
        setSettings(result.data || null);
        setFailed(Boolean(result.error));
    };

    useEffect(() => {
        load();

    // Reload only when the active instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.activeInstance?.instance_id]);

    const toggle = async (role: RHSNotificationRole, enabled: boolean) => {
        setSavingRole(role);
        setError('');
        const result = await props.setRHSNotificationRole(role, enabled);
        setSavingRole('');
        if (result.error || !result.data) {
            setError(RHS_STRINGS.settingsNotifyFailed);
            return;
        }
        setSettings(result.data);
    };

    const disconnect = async () => {
        if (!props.activeInstance) {
            return;
        }
        setDisconnecting(true);
        const result = await props.disconnectUser(props.activeInstance.instance_id);
        setDisconnecting(false);
        if (result && result.error) {
            setError(RHS_STRINGS.settingsDisconnectFailed);
            return;
        }
        props.closeRHSSettings();
    };

    const copyWebhook = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const runWizard = async () => {
        const result = await props.startJiraSetupWizard(props.channelId, props.teamId);
        setWizard(result.error ? 'failed' : 'started');
    };

    const connectedIDs = new Set(props.connectedInstances.map((i) => i.instance_id));
    const notConnected = props.installedInstances.filter((i) => !connectedIDs.has(i.instance_id));

    let body: React.ReactNode = failed ? <RHSErrorState onRetry={load}/> : <RHSLoadingState/>;
    if (settings) {
        const active = props.activeInstance;
        body = (
            <div
                className='jira-rhs-settings'
                data-testid='rhs-settings'
            >
                <section className='jira-rhs-settings-block'>
                    <div className='jira-rhs-settings-account'>
                        <RHSAvatar name={settings.account.displayName || settings.account.name || '?'}/>
                        <div className='jira-rhs-settings-account-main'>
                            <b data-testid='rhs-settings-account'>{settings.account.displayName || settings.account.name}</b>
                            {active && (
                                <span className='jira-rhs-small jira-rhs-muted'>
                                    {rhsInstanceName(active) + ' · ' + rhsInstanceKind(active)}
                                </span>
                            )}
                        </div>
                        {!confirmDisconnect && (
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                data-testid='rhs-settings-disconnect'
                                onClick={() => setConfirmDisconnect(true)}
                            >
                                {RHS_STRINGS.settingsDisconnect}
                            </button>
                        )}
                    </div>
                    {confirmDisconnect && active && (
                        <div
                            className='jira-rhs-subscription-confirm'
                            role='alertdialog'
                        >
                            <span>{RHS_STRINGS.settingsDisconnectConfirm.replace('{instance}', rhsInstanceName(active))}</span>
                            <button
                                type='button'
                                className='btn btn-danger btn-sm'
                                data-testid='rhs-settings-disconnect-confirm'
                                disabled={disconnecting}
                                onClick={disconnect}
                            >
                                {RHS_STRINGS.settingsDisconnect}
                            </button>
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                onClick={() => setConfirmDisconnect(false)}
                            >
                                {RHS_STRINGS.cancel}
                            </button>
                        </div>
                    )}
                    {notConnected.map((instance) => (
                        <div
                            key={instance.instance_id}
                            className='jira-rhs-settings-row'
                        >
                            <span className='jira-rhs-small'>{rhsInstanceName(instance) + ' · ' + rhsInstanceKind(instance)}</span>
                            <button
                                type='button'
                                className='jira-rhs-link-button'
                                data-testid={'rhs-settings-connect-' + instance.instance_id}
                                onClick={() => props.handleConnectFlow(instance.instance_id)}
                            >
                                {RHS_STRINGS.settingsConnectOther}
                            </button>
                        </div>
                    ))}
                </section>

                {error && (
                    <div
                        className='jira-rhs-card-alert jira-rhs-channel-alert'
                        role='alert'
                    >
                        {error}
                    </div>
                )}

                <section className='jira-rhs-settings-block'>
                    <h4 className='jira-rhs-settings-title'>{RHS_STRINGS.settingsNotifications}</h4>
                    {RHS_NOTIFICATION_ROLES.map((role) => (
                        <label
                            key={role}
                            className='jira-rhs-switch-row'
                        >
                            <span>{ROLE_LABELS[role]}</span>
                            <input
                                type='checkbox'
                                role='switch'
                                className='jira-rhs-switch'
                                data-testid={'rhs-settings-notify-' + role}
                                checked={Boolean(settings.notifications[role])}
                                disabled={savingRole !== ''}
                                onChange={(event) => toggle(role, event.target.checked)}
                            />
                        </label>
                    ))}
                </section>

                {settings.admin && (
                    <section
                        className='jira-rhs-settings-block'
                        data-testid='rhs-settings-admin'
                    >
                        <h4 className='jira-rhs-settings-title'>
                            {RHS_STRINGS.settingsAdmin}
                            <span className='jira-rhs-small jira-rhs-muted'>{' · ' + RHS_STRINGS.settingsAdminHint}</span>
                        </h4>

                        <div className='jira-rhs-settings-row jira-rhs-settings-row--top'>
                            <div className='jira-rhs-settings-col'>
                                <b>{RHS_STRINGS.settingsInstances}</b>
                                {settings.admin.instances.map((instance) => (
                                    <span
                                        key={instance.instance_id}
                                        className='jira-rhs-small jira-rhs-muted'
                                    >
                                        {(instance.alias || instance.instance_id) + (instance.type === 'server' ? ' (' + RHS_STRINGS.instanceServer + ')' : ' (' + RHS_STRINGS.instanceCloud + ')') +
                                            (instance.instance_id === props.defaultInstanceID ? ' · ' + RHS_STRINGS.settingsDefault : '')}
                                    </span>
                                ))}
                            </div>
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                data-testid='rhs-settings-manage'
                                onClick={() => navigateInApp(props.adminConsoleURL)}
                            >
                                {RHS_STRINGS.settingsManage}
                            </button>
                        </div>

                        <div className='jira-rhs-settings-row jira-rhs-settings-row--top'>
                            <div className='jira-rhs-settings-col'>
                                <b>{RHS_STRINGS.settingsWebhook}</b>
                                <code
                                    className='jira-rhs-settings-code'
                                    data-testid='rhs-settings-webhook'
                                    title={RHS_STRINGS.settingsWebhookHint}
                                >
                                    {maskWebhookSecret(settings.admin.webhook_url)}
                                </code>
                            </div>
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                data-testid='rhs-settings-copy-webhook'
                                onClick={() => copyWebhook(settings.admin?.webhook_url || '')}
                            >
                                {copied ? RHS_STRINGS.settingsCopied : RHS_STRINGS.settingsCopy}
                            </button>
                        </div>

                        <div className='jira-rhs-settings-row jira-rhs-settings-row--top'>
                            <div className='jira-rhs-settings-col'>
                                <b>{RHS_STRINGS.settingsWizard}</b>
                                <span className='jira-rhs-small jira-rhs-muted'>{RHS_STRINGS.settingsWizardHint}</span>
                                {wizard === 'started' && <span className='jira-rhs-small'>{RHS_STRINGS.setupStarted}</span>}
                                {wizard === 'failed' && <span className='jira-rhs-small jira-rhs-connect-hint--error'>{RHS_STRINGS.setupFailed}</span>}
                            </div>
                            <button
                                type='button'
                                className='btn btn-tertiary btn-sm'
                                data-testid='rhs-settings-wizard'
                                onClick={runWizard}
                            >
                                {RHS_STRINGS.settingsWizardRun}
                            </button>
                        </div>
                    </section>
                )}

                <p className='jira-rhs-small jira-rhs-muted jira-rhs-settings-version'>
                    {RHS_STRINGS.settingsVersion.replace('{version}', settings.plugin_version)}
                </p>
            </div>
        );
    }

    return (
        <div
            className='jira-rhs-card'
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !event.defaultPrevented) {
                    props.closeRHSSettings();
                }
            }}
        >
            <div className='jira-rhs-card-top'>
                <button
                    type='button'
                    className='jira-rhs-icon-button'
                    aria-label={RHS_STRINGS.back}
                    title={RHS_STRINGS.back}
                    data-testid='rhs-settings-back'
                    onClick={props.closeRHSSettings}
                >
                    <i
                        className='icon icon-arrow-left'
                        aria-hidden={true}
                    />
                </button>
                <span className='jira-rhs-attach-title'>{RHS_STRINGS.settings}</span>
            </div>
            {body}
        </div>
    );
}
