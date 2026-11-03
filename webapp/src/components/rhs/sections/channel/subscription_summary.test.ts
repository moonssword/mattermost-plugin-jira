// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RHSChannelSubscription} from 'types/rhs_channel';

import {subscriptionEvents} from './subscription_summary';

describe('components/rhs/sections/channel/subscription_summary', () => {
    test('events keep one order whatever order the server stored', () => {
        const make = (events: string[]) => ({filters: {events}} as unknown as RHSChannelSubscription);
        const expected = 'События: создана, решена, новый комментарий, комментарий изменён';
        expect(subscriptionEvents(make(['event_created_comment', 'event_updated_comment', 'event_created', 'event_updated_resolved']))).toBe(expected);
        expect(subscriptionEvents(make(['event_updated_resolved', 'event_created', 'event_updated_comment', 'event_created_comment']))).toBe(expected);
        expect(subscriptionEvents(make([]))).toBe('События: все');
    });
});
