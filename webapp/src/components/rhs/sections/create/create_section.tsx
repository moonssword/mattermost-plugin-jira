// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHS_STRINGS} from '../../rhs_strings';

export type Props = {
    instanceID: string;
    channelId: string;
    openCreateModalWithoutPost: (description: string, channelId: string) => void;
};

// Issue creation. Stage 6d moves the create form from the modal into the panel.
export default function CreateSection(props: Props): JSX.Element {
    return (
        <div
            className='jira-rhs-placeholder'
            data-testid='rhs-create-section'
        >
            <h4 className='jira-rhs-placeholder-title'>{RHS_STRINGS.createTitle}</h4>
            <p className='jira-rhs-placeholder-text'>{RHS_STRINGS.createText}</p>
            <button
                type='button'
                className='btn btn-primary'
                data-testid='rhs-new-ticket'
                onClick={() => props.openCreateModalWithoutPost('', props.channelId)}
            >
                <i
                    className='icon icon-plus'
                    aria-hidden={true}
                />
                {RHS_STRINGS.createOpen}
            </button>
        </div>
    );
}
