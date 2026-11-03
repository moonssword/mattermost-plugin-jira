// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHS_STRINGS} from '../../rhs_strings';

export type Props = {
    instanceID: string;
    channelId: string;
    openChannelSettings: (channelId: string) => void;
};

// Channel subscriptions. Stage 6f replaces the modal with an in-panel editor.
export default function ChannelSection(props: Props): JSX.Element {
    return (
        <div
            className='jira-rhs-placeholder'
            data-testid='rhs-channel-section'
        >
            <h4 className='jira-rhs-placeholder-title'>{RHS_STRINGS.channelTitle}</h4>
            <p className='jira-rhs-placeholder-text'>
                {props.channelId ? RHS_STRINGS.channelText : RHS_STRINGS.channelNoChannel}
            </p>
            {props.channelId && (
                <button
                    type='button'
                    className='btn btn-secondary'
                    data-testid='rhs-open-channel-subscriptions'
                    onClick={() => props.openChannelSettings(props.channelId)}
                >
                    {RHS_STRINGS.channelOpen}
                </button>
            )}
        </div>
    );
}
