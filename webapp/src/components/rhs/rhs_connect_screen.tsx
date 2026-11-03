// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {Instance} from 'types/model';

import {rhsInstanceOptionLabel} from './rhs_instance_label';
import {RHS_STRINGS} from './rhs_strings';

function JiraLogo(): JSX.Element {
    return (
        <div
            className='jira-rhs-logo'
            aria-hidden={true}
        >
            <svg
                viewBox='0 0 24 24'
                width='30'
                height='30'
                focusable='false'
            >
                <path d='M22.2 11.3 12.7 1.8 12 1l-7.1 7.2-3.1 3.1a1 1 0 0 0 0 1.4l6.5 6.5L12 23l7.1-7.2.1-.1 3-3a1 1 0 0 0 0-1.4ZM12 15.2 8.8 12 12 8.8l3.2 3.2L12 15.2Z'/>
            </svg>
        </div>
    );
}

export type ConnectProps = {
    instances: Instance[];
    onConnect: (instanceID: string) => void;
};

// First-run screen instead of /jira connect. The instance list is hidden when
// only one instance can be connected.
export function RHSConnectScreen(props: ConnectProps): JSX.Element {
    const [instanceID, setInstanceID] = useState(props.instances[0]?.instance_id || '');
    const [waiting, setWaiting] = useState(false);

    useEffect(() => {
        if (!props.instances.some((instance) => instance.instance_id === instanceID)) {
            setInstanceID(props.instances[0]?.instance_id || '');
        }
    }, [props.instances, instanceID]);

    const onConnect = () => {
        setWaiting(true);
        props.onConnect(instanceID);
    };

    return (
        <div
            className='jira-rhs-connect'
            data-testid='rhs-state-not-connected'
        >
            <JiraLogo/>
            <h3 className='jira-rhs-connect-title'>{RHS_STRINGS.connectTitle}</h3>
            <p className='jira-rhs-connect-text'>{RHS_STRINGS.connectText}</p>
            {props.instances.length > 1 && (
                <label className='jira-rhs-field'>
                    <span className='jira-rhs-field-label'>{RHS_STRINGS.instanceLabel}</span>
                    <select
                        className='jira-rhs-select jira-rhs-select--wide'
                        data-testid='rhs-connect-instance'
                        value={instanceID}
                        onChange={(event) => setInstanceID(event.target.value)}
                    >
                        {props.instances.map((instance) => (
                            <option
                                key={instance.instance_id}
                                value={instance.instance_id}
                            >
                                {rhsInstanceOptionLabel(instance)}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <button
                type='button'
                className='btn btn-primary jira-rhs-wide-button'
                data-testid='rhs-connect'
                disabled={!instanceID}
                onClick={onConnect}
            >
                {RHS_STRINGS.connect}
            </button>
            <span className='jira-rhs-connect-hint'>
                {waiting ? RHS_STRINGS.connectWaiting : RHS_STRINGS.connectHint}
            </span>
        </div>
    );
}

export type NoInstanceProps = {
    isAdmin: boolean;
    onRunSetup: () => Promise<boolean>;
};

type SetupState = 'idle' | 'running' | 'started' | 'failed';

// Shown when no Jira instance is installed: regular users are told to ask an
// admin, system admins can start the setup wizard right away.
export function RHSNoInstanceScreen(props: NoInstanceProps): JSX.Element {
    const [setup, setSetup] = useState<SetupState>('idle');

    const onRunSetup = async () => {
        setSetup('running');
        const ok = await props.onRunSetup();
        setSetup(ok ? 'started' : 'failed');
    };

    return (
        <div
            className='jira-rhs-connect'
            data-testid='rhs-state-no-instance'
        >
            <JiraLogo/>
            <h3 className='jira-rhs-connect-title'>{RHS_STRINGS.noInstanceTitle}</h3>
            <p className='jira-rhs-connect-text'>
                {props.isAdmin ? RHS_STRINGS.noInstanceAdmin : RHS_STRINGS.noInstanceUser}
            </p>
            {props.isAdmin && (
                <button
                    type='button'
                    className='btn btn-primary jira-rhs-wide-button'
                    data-testid='rhs-run-setup'
                    disabled={setup === 'running'}
                    onClick={onRunSetup}
                >
                    {RHS_STRINGS.runSetup}
                </button>
            )}
            {setup === 'started' && <span className='jira-rhs-connect-hint'>{RHS_STRINGS.setupStarted}</span>}
            {setup === 'failed' && <span className='jira-rhs-connect-hint jira-rhs-connect-hint--error'>{RHS_STRINGS.setupFailed}</span>}
        </div>
    );
}
