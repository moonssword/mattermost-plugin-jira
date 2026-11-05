// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import Loading from 'components/loading';

import {
    RHSSkeletonCard,
    RHSSkeletonFields,
    RHSSkeletonList,
    RHSSkeletonOptions,
    RHSSkeletonPanel,
    RHSSkeletonRows,
    RHSSkeletonSettings,
    RHSSkeletonSprint,
    RHSSkeletonSubscriptions,
} from './rhs_skeleton';

const screens: [string, JSX.Element][] = [
    ['panel', <RHSSkeletonPanel key='panel'/>],
    ['list', <RHSSkeletonList key='list'/>],
    ['card', <RHSSkeletonCard key='card'/>],
    ['fields', <RHSSkeletonFields key='fields'/>],
    ['subscriptions', <RHSSkeletonSubscriptions key='subscriptions'/>],
    ['settings', <RHSSkeletonSettings key='settings'/>],
    [
        'options',
        <RHSSkeletonOptions
            key='options'
            itemClassName='x'
        />,
    ],
    ['sprint', <RHSSkeletonSprint key='sprint'/>],
    ['modal', <Loading key='modal'/>],
];

describe('skeletons', () => {
    test.each(screens)('%s shows shapes and no loading text', (_, element) => {
        const {container} = render(element);
        expect(container.textContent).toBe('');
        expect(container.querySelectorAll('.jira-skel').length).toBeGreaterThan(0);
        expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Загрузка');
    });

    test('rows use the classes of the real rows', () => {
        const {container} = render(<RHSSkeletonRows count={3}/>);
        expect(container.querySelectorAll('.jira-rhs-row').length).toBe(3);
        expect(container.querySelector('.jira-rhs-row-summary')).toBeTruthy();
    });
});
