// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Instance} from 'types/model';

import RHSInstancePicker from './rhs_instance_picker';
import {rhsInstanceKind, rhsInstanceName} from './rhs_instance_label';

export type Props = {
    instances: Instance[];
    activeInstanceID: string;
    onInstanceChange: (instanceID: string) => void;
    actions?: React.ReactNode;
};

// Top bar of the panel: the active Jira instance (a picker when the user is
// connected to several) and room for panel-wide actions.
export default function RHSPanelHeader(props: Props): JSX.Element {
    const active = props.instances.find((instance) => instance.instance_id === props.activeInstanceID);

    let instance: React.ReactNode = null;
    if (props.instances.length > 1) {
        instance = (
            <RHSInstancePicker
                instances={props.instances}
                selectedInstanceID={props.activeInstanceID}
                onChange={props.onInstanceChange}
            />
        );
    } else if (active) {
        instance = (
            <span
                className='jira-rhs-panel-instance'
                data-testid='rhs-instance-name'
                title={active.instance_id}
            >
                <span className='jira-rhs-panel-instance-name'>{rhsInstanceName(active)}</span>
                <span className='jira-rhs-panel-instance-kind'>{rhsInstanceKind(active)}</span>
            </span>
        );
    }

    return (
        <div
            className='jira-rhs-panel-header'
            data-testid='rhs-panel-header'
        >
            {instance}
            {props.actions && <div className='jira-rhs-panel-actions'>{props.actions}</div>}
        </div>
    );
}
