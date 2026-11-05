// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';

import EditChannelSubscription from 'components/modals/channel_subscriptions/edit_channel_subscription';
import {SharedProps} from 'components/modals/channel_subscriptions/shared_props';
import {APIResponse, ChannelSubscription} from 'types/model';
import {RHSChannelSubscription, RHSChannelSubscriptions} from 'types/rhs_channel';

import {RHSErrorState, RHSLoadingState} from '../../rhs_states';
import {RHS_STRINGS} from '../../rhs_strings';

import {subscriptionEvents, subscriptionPausedLine, subscriptionScope} from './subscription_summary';

type Result = Promise<{data?: RHSChannelSubscriptions; error?: unknown}>;

export type Props = SharedProps & {
    instanceID: string;
    channelId: string;
    isDirectOrGroup: boolean;
    openChannelSettings: (channelID: string) => unknown;
    loadRHSChannelSubscriptions: (channelID: string) => Result;
    setRHSSubscriptionPaused: (channelID: string, subscriptionID: string, paused: boolean) => Result;
};

type Editing = {mode: 'create'} | {mode: 'edit'; sub: ChannelSubscription} | null;

// ChannelSection replaces /jira subscribe and /jira subscribe list. Every
// channel member sees the subscriptions; only users allowed by the plugin's
// "roles allowed to edit subscriptions" setting see the actions. Creating
// and editing reuse the plugin's own subscription editor.
export default function ChannelSection(props: Props): JSX.Element {
    const {channelId, instanceID} = props;
    const [data, setData] = useState<RHSChannelSubscriptions | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [editing, setEditing] = useState<Editing>(null);
    const [confirmDelete, setConfirmDelete] = useState('');
    const [busy, setBusy] = useState('');
    const [actionError, setActionError] = useState('');
    const [nowMs] = useState(() => Date.now());

    const load = useCallback(async () => {
        if (!channelId || !instanceID) {
            return;
        }
        setLoading(true);
        const result = await props.loadRHSChannelSubscriptions(channelId);
        setLoading(false);
        setFailed(Boolean(result.error));
        setData(result.data || null);

    // The loader is a bound action creator and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, instanceID]);

    useEffect(() => {
        setEditing(null);
        setConfirmDelete('');
        setActionError('');
        load();
    }, [load]);

    const startEditing = async (next: Editing) => {
        // The editor checks names against the channel's subscriptions and
        // offers templates, both read from the plugin store.
        await Promise.all([
            props.fetchChannelSubscriptions(channelId),
            props.fetchAllSubscriptionTemplates(),
        ]);
        setActionError('');
        setEditing(next);
    };

    const finishEditing = () => {
        setEditing(null);
        load();
    };

    const onPause = async (sub: RHSChannelSubscription) => {
        setBusy(sub.id);
        setActionError('');
        const result = await props.setRHSSubscriptionPaused(channelId, sub.id, !sub.paused);
        setBusy('');
        if (result.error || !result.data) {
            setActionError(RHS_STRINGS.cardActionFailed);
            return;
        }
        setData(result.data);
    };

    const onDelete = async (sub: RHSChannelSubscription) => {
        setBusy(sub.id);
        setActionError('');
        const result: APIResponse<{}> = await props.deleteChannelSubscription(sub);
        setBusy('');
        setConfirmDelete('');
        if (result.error) {
            setActionError(result.error.message || RHS_STRINGS.cardActionFailed);
            return;
        }
        load();
    };

    if (!channelId) {
        return <p className='jira-rhs-placeholder jira-rhs-muted'>{RHS_STRINGS.channelNoChannel}</p>;
    }
    if (props.isDirectOrGroup) {
        return <p className='jira-rhs-placeholder jira-rhs-muted'>{RHS_STRINGS.channelDirect}</p>;
    }

    if (editing) {
        return (
            <div
                className='jira-rhs-subscription-editor'
                data-testid='rhs-subscription-editor'
            >
                <div className='jira-rhs-form-header'>
                    <button
                        type='button'
                        className='jira-rhs-icon-button'
                        aria-label={RHS_STRINGS.back}
                        title={RHS_STRINGS.back}
                        data-testid='rhs-subscription-editor-back'
                        onClick={finishEditing}
                    >
                        <i
                            className='icon icon-arrow-left'
                            aria-hidden={true}
                        />
                    </button>
                    <span className='jira-rhs-form-title'>
                        {editing.mode === 'create' ? RHS_STRINGS.channelEditTitleNew : (editing.sub.name || RHS_STRINGS.channelEditTitle)}
                    </span>
                    <button
                        type='button'
                        className='jira-rhs-icon-button'
                        aria-label={RHS_STRINGS.channelInModal}
                        title={RHS_STRINGS.channelInModal}
                        data-testid='rhs-subscription-in-modal'
                        onClick={() => {
                            finishEditing();
                            props.openChannelSettings(channelId);
                        }}
                    >
                        <i
                            className='icon icon-arrow-expand'
                            aria-hidden={true}
                        />
                    </button>
                </div>
                <div className='jira-rhs-subscription-editor-body'>
                    <EditChannelSubscription
                        {...props}
                        panel={true}
                        finishEditSubscription={finishEditing}
                        selectedSubscription={editing.mode === 'edit' ? editing.sub : null}
                        creatingSubscription={editing.mode === 'create'}
                        creatingSubscriptionTemplate={false}
                        selectedSubscriptionTemplate={null}
                    />
                </div>
            </div>
        );
    }

    if (!data && loading) {
        return <RHSLoadingState/>;
    }
    if (!data || failed) {
        return <RHSErrorState onRetry={load}/>;
    }

    const canManage = data.can_manage;

    return (
        <div
            className='jira-rhs-channel'
            data-testid='rhs-channel-section'
        >
            <div className='jira-rhs-channel-head'>
                <span className='jira-rhs-found'>{RHS_STRINGS.channelTitle}</span>
                {canManage && (
                    <button
                        type='button'
                        className='btn btn-primary btn-sm'
                        data-testid='rhs-subscription-add'
                        onClick={() => startEditing({mode: 'create'})}
                    >
                        <i
                            className='icon icon-plus'
                            aria-hidden={true}
                        />
                        {RHS_STRINGS.channelAdd}
                    </button>
                )}
            </div>
            {actionError && (
                <div
                    className='jira-rhs-card-alert jira-rhs-channel-alert'
                    role='alert'
                >
                    {actionError}
                </div>
            )}
            {data.subscriptions.length === 0 && (
                <p className='jira-rhs-muted jira-rhs-channel-empty'>
                    {RHS_STRINGS.channelEmpty + ' ' + (canManage ? RHS_STRINGS.channelEmptyManager : '')}
                </p>
            )}
            <ul className='jira-rhs-subscriptions'>
                {data.subscriptions.map((sub) => (
                    <li
                        key={sub.id}
                        className={sub.paused ? 'jira-rhs-subscription jira-rhs-subscription--paused' : 'jira-rhs-subscription'}
                        data-testid={'rhs-subscription-' + sub.id}
                    >
                        <div className='jira-rhs-subscription-name'>{sub.name || RHS_STRINGS.channelNoName}</div>
                        {sub.paused ? (
                            <div className='jira-rhs-small jira-rhs-muted'>{subscriptionPausedLine(sub, nowMs)}</div>
                        ) : (
                            <>
                                <div className='jira-rhs-small jira-rhs-muted'>{subscriptionScope(sub)}</div>
                                <div className='jira-rhs-small jira-rhs-muted'>{subscriptionEvents(sub)}</div>
                            </>
                        )}
                        {canManage && confirmDelete !== sub.id && (
                            <div className='jira-rhs-subscription-actions'>
                                <button
                                    type='button'
                                    className='jira-rhs-link-button'
                                    data-testid={'rhs-subscription-edit-' + sub.id}
                                    disabled={busy === sub.id}
                                    onClick={() => startEditing({mode: 'edit', sub})}
                                >
                                    {RHS_STRINGS.channelEdit}
                                </button>
                                <button
                                    type='button'
                                    className='jira-rhs-link-button'
                                    data-testid={'rhs-subscription-pause-' + sub.id}
                                    disabled={busy === sub.id}
                                    onClick={() => onPause(sub)}
                                >
                                    {sub.paused ? RHS_STRINGS.channelResume : RHS_STRINGS.channelPause}
                                </button>
                                <button
                                    type='button'
                                    className='jira-rhs-link-button jira-rhs-link-button--danger'
                                    data-testid={'rhs-subscription-delete-' + sub.id}
                                    disabled={busy === sub.id}
                                    onClick={() => setConfirmDelete(sub.id)}
                                >
                                    {RHS_STRINGS.channelDelete}
                                </button>
                            </div>
                        )}
                        {canManage && confirmDelete === sub.id && (
                            <div
                                className='jira-rhs-subscription-confirm'
                                role='alertdialog'
                            >
                                <span>{RHS_STRINGS.channelDeleteConfirm.replace('{name}', sub.name || RHS_STRINGS.channelNoName)}</span>
                                <button
                                    type='button'
                                    className='btn btn-danger btn-sm'
                                    data-testid={'rhs-subscription-delete-confirm-' + sub.id}
                                    disabled={busy === sub.id}
                                    onClick={() => onDelete(sub)}
                                >
                                    {RHS_STRINGS.channelDelete}
                                </button>
                                <button
                                    type='button'
                                    className='btn btn-tertiary btn-sm'
                                    onClick={() => setConfirmDelete('')}
                                >
                                    {RHS_STRINGS.cancel}
                                </button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
            {!canManage && data.subscriptions.length > 0 && (
                <p className='jira-rhs-muted jira-rhs-small jira-rhs-channel-empty'>{RHS_STRINGS.channelReadOnly}</p>
            )}
        </div>
    );
}
