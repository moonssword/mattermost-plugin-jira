// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';

import {RHSChannelSubscription, RHSChannelSubscriptions} from 'types/rhs_channel';

import {RHS_STRINGS} from '../../rhs_strings';

import ChannelSection, {Props} from './channel_section';
import {
    rhsEventLabel,
    subscriptionEvents,
    subscriptionPausedLine,
    subscriptionScope,
} from './subscription_summary';

jest.mock('components/modals/channel_subscriptions/edit_channel_subscription', () => (props: any) => (
    <div data-testid='upstream-editor'>
        {props.creatingSubscription ? 'create' : 'edit:' + props.selectedSubscription.id}
        <button
            type='button'
            data-testid='upstream-editor-done'
            onClick={props.finishEditSubscription}
        >
            {'done'}
        </button>
    </div>
));

const active: RHSChannelSubscription = {
    id: 's1',
    channel_id: 'c1',
    name: 'Баги бэкенда',
    instance_id: 'http://jira.example.com',
    filters: {events: ['event_created', 'event_updated_status'], projects: ['BACK'], issue_types: ['1', '2'], fields: [{key: 'priority', inclusion: 'include_any', values: ['1']}]} as never,
};

const paused: RHSChannelSubscription = {
    ...active,
    id: 's2',
    name: 'Релиз',
    paused: true,
    paused_at: Date.parse('2026-10-28T10:00:00Z'),
    paused_by_name: 'Анна Смирнова',
};

function listResult(canManage: boolean, subs = [active, paused]): {data: RHSChannelSubscriptions} {
    return {data: {subscriptions: subs, can_manage: canManage}};
}

function makeProps(overrides: Partial<Props> = {}): Props {
    return {
        instanceID: 'http://jira.example.com',
        channelId: 'c1',
        isDirectOrGroup: false,
        loadRHSChannelSubscriptions: jest.fn(async () => listResult(true)),
        setRHSSubscriptionPaused: jest.fn(async () => listResult(true, [{...active, paused: true}, paused])),
        deleteChannelSubscription: jest.fn(async () => ({data: {}})),
        fetchChannelSubscriptions: jest.fn(async () => ({data: []})),
        fetchAllSubscriptionTemplates: jest.fn(async () => ({data: []})),
        ...overrides,
    } as unknown as Props;
}

describe('components/rhs/sections/channel', () => {
    test('summary helpers', () => {
        expect(subscriptionScope(active)).toBe('Проект BACK · типов задач: 2 · фильтров: 1');
        expect(subscriptionEvents(active)).toBe('События: создана, статус изменён');
        expect(subscriptionEvents({...active, filters: {...active.filters, events: []}})).toBe('События: все');
        expect(rhsEventLabel('event_updated_customfield_10010')).toBe('изменено поле customfield_10010');
        expect(subscriptionPausedLine(paused, Date.parse('2026-11-03T00:00:00Z'))).toBe('Приостановлена 28 окт · Анна Смирнова');
    });

    test('managers see actions, paused subscriptions show who paused them', async () => {
        render(<ChannelSection {...makeProps()}/>);
        expect(await screen.findByTestId('rhs-subscription-s1')).toHaveTextContent('Баги бэкенда');
        expect(screen.getByTestId('rhs-subscription-s2')).toHaveTextContent('Приостановлена 28 окт · Анна Смирнова');
        expect(screen.getByTestId('rhs-subscription-pause-s1')).toHaveTextContent(RHS_STRINGS.channelPause);
        expect(screen.getByTestId('rhs-subscription-pause-s2')).toHaveTextContent(RHS_STRINGS.channelResume);
        expect(screen.getByTestId('rhs-subscription-add')).toBeInTheDocument();
    });

    test('other members see the list without actions', async () => {
        render(<ChannelSection {...makeProps({loadRHSChannelSubscriptions: jest.fn(async () => listResult(false))})}/>);
        expect(await screen.findByTestId('rhs-subscription-s1')).toBeInTheDocument();
        expect(screen.queryByTestId('rhs-subscription-add')).toBeNull();
        expect(screen.queryByTestId('rhs-subscription-edit-s1')).toBeNull();
        expect(screen.getByText(RHS_STRINGS.channelReadOnly)).toBeInTheDocument();
    });

    test('pause toggles through the server and shows the new state', async () => {
        const props = makeProps();
        render(<ChannelSection {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-subscription-pause-s1'));
        await waitFor(() => expect(screen.getByTestId('rhs-subscription-pause-s1')).toHaveTextContent(RHS_STRINGS.channelResume));
        expect(props.setRHSSubscriptionPaused).toHaveBeenCalledWith('c1', 's1', true);
    });

    test('delete asks first and reloads afterwards', async () => {
        const props = makeProps();
        render(<ChannelSection {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-subscription-delete-s1'));
        expect(screen.getByRole('alertdialog')).toHaveTextContent('Удалить подписку «Баги бэкенда»?');
        fireEvent.click(screen.getByTestId('rhs-subscription-delete-confirm-s1'));
        await waitFor(() => expect(props.loadRHSChannelSubscriptions).toHaveBeenCalledTimes(2));
        expect(props.deleteChannelSubscription).toHaveBeenCalledWith(active);
    });

    test('create and edit open the plugin editor and reload when it finishes', async () => {
        const props = makeProps();
        render(<ChannelSection {...props}/>);
        fireEvent.click(await screen.findByTestId('rhs-subscription-edit-s1'));
        expect(await screen.findByTestId('upstream-editor')).toHaveTextContent('edit:s1');
        expect(props.fetchChannelSubscriptions).toHaveBeenCalledWith('c1');

        fireEvent.click(screen.getByTestId('upstream-editor-done'));
        await waitFor(() => expect(props.loadRHSChannelSubscriptions).toHaveBeenCalledTimes(2));

        fireEvent.click(await screen.findByTestId('rhs-subscription-add'));
        expect(await screen.findByTestId('upstream-editor')).toHaveTextContent('create');
    });

    test('direct and group messages have no subscriptions', () => {
        render(<ChannelSection {...makeProps({isDirectOrGroup: true})}/>);
        expect(screen.getByText(RHS_STRINGS.channelDirect)).toBeInTheDocument();
    });

    test('a load error offers a retry', async () => {
        render(<ChannelSection {...makeProps({loadRHSChannelSubscriptions: jest.fn(async () => ({error: new Error('x')}))})}/>);
        expect(await screen.findByTestId('rhs-state-error')).toBeInTheDocument();
    });
});
