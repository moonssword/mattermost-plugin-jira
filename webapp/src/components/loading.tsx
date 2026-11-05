// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {tr} from 'utils/i18n';

import './loading.scss';

const BLOCKS = ['35%', '100%', '35%', '100%', '35%', '100%'];

// Loading is a skeleton of a form: the modals load their fields with it.
const Loading = () => {
    return (
        <div
            className='jira-skel-group'
            role='status'
            aria-busy={true}
            aria-label={tr('Загрузка')}
            data-testid='jira-skeleton'
        >
            {BLOCKS.map((width, index) => (
                <span
                    key={String(index)}
                    className={index % 2 ? 'jira-skel jira-skel--control' : 'jira-skel'}
                    style={{width}}
                    aria-hidden={true}
                />
            ))}
        </div>
    );
};

export default Loading;
