// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {applyMiddleware, createStore} from 'redux';
import thunk from 'redux-thunk';

import {InstanceType} from 'types/model';
import {pluginStateKey} from 'types/store';

import ActionTypes from '../action_types';
import reducer from '../reducers';
import {setRHSMounted} from 'utils/rhs_controller';

import {RHS_LIVE_DELAY_MS, createRHSLiveHandler} from './rhs_live';

const instance = {instance_id: 'http://jira.example.com', type: InstanceType.SERVER};

function makeStore() {
    const initialState = {
        entities: {general: {config: {SiteURL: 'http://localhost:8065'}}, users: {currentUserId: 'u1'}},
        [pluginStateKey]: reducer({} as any, {type: '@@INIT'} as any),
    };
    const root = (state = initialState, action: any) => ({
        entities: state.entities,
        [pluginStateKey]: reducer(state[pluginStateKey], action),
    });
    const store = createStore(root, applyMiddleware(thunk));
    store.dispatch({type: ActionTypes.RECEIVED_INSTANCE_STATUS, data: {instances: [instance]}});
    store.dispatch({
        type: ActionTypes.RECEIVED_CONNECTED,
        data: {can_connect: true, is_connected: true, user_info: {connected_instances: [instance], default_instance_id: instance.instance_id}},
    });
    store.dispatch({type: ActionTypes.SET_RHS_VIEW, data: {instanceID: instance.instance_id, filter: 'assigned', query: '', sort: 'updated'}});
    return store;
}

const issue = (key: string, status = 'Open') => ({
    key,
    summary: key,
    browseUrl: '',
    status: {name: status, categoryKey: 'new'},
    issueType: 'Task',
    project: 'TES',
    updated: '',
});

function seedList(store: ReturnType<typeof makeStore>) {
    store.dispatch({type: ActionTypes.RHS_ISSUES_LOADING, data: {reset: true}});
    store.dispatch({type: ActionTypes.RECEIVED_RHS_ISSUES, data: {issues: [issue('TES-1')], isLast: true}, requestId: store.getState()[pluginStateKey].rhs.requestId});
}

function mockFetch(body: unknown) {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body)}));
    return fetchMock;
}

const msg = (key: string, instanceID = instance.instance_id) => ({data: {instance_id: instanceID, issue_key: key}});

async function flushTimers() {
    jest.advanceTimersByTime(RHS_LIVE_DELAY_MS);

    // Let the fetch, its json() and the dispatch settle.
    for (let i = 0; i < 10; i++) {
        await Promise.resolve(); // eslint-disable-line no-await-in-loop
    }
}

describe('actions/rhs_live', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        setRHSMounted(false);
    });

    test('a burst of events refreshes the open list once, in place', async () => {
        const store = makeStore();
        seedList(store);
        setRHSMounted(true);
        const fetchMock = mockFetch({issues: [issue('TES-1', 'Done'), issue('TES-2')], nextPageToken: '', isLast: true});
        const handle = createRHSLiveHandler(store as any);

        handle(msg('TES-1'));
        handle(msg('TES-2'));
        handle(msg('TES-1'));
        expect(store.getState()[pluginStateKey].rhs.issues).toHaveLength(1);
        await flushTimers();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/rhs/issues');
        expect(store.getState()[pluginStateKey].rhs.issues.map((i: {key: string}) => i.key)).toEqual(['TES-1', 'TES-2']);
    });

    test('with the panel closed the list is only marked stale', async () => {
        const store = makeStore();
        seedList(store);
        const fetchMock = mockFetch({});
        const handle = createRHSLiveHandler(store as any);

        handle(msg('TES-1'));
        await flushTimers();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(store.getState()[pluginStateKey].rhs.stale).toBe(true);
    });

    test('events of another instance are ignored', async () => {
        const store = makeStore();
        seedList(store);
        setRHSMounted(true);
        const fetchMock = mockFetch({});
        const handle = createRHSLiveHandler(store as any);

        handle(msg('TES-1', 'https://other.atlassian.net'));
        handle({data: {}});
        await flushTimers();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('the open card reloads when its issue changed', async () => {
        const store = makeStore();
        store.dispatch({type: ActionTypes.OPEN_RHS_ISSUE, data: 'TES-9'});
        store.dispatch({type: ActionTypes.RHS_CARD_LOADING, data: 'TES-9'});
        const fetchMock = mockFetch({...issue('TES-9', 'Done'), assignee: null, reporter: null, labels: [], description: '', transitions: [], comments: [], commentsTotal: 0, me: {displayName: 'Me'}});
        const handle = createRHSLiveHandler(store as any);

        handle(msg('TES-9'));
        await flushTimers();

        const urls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.includes('/api/v2/rhs/issue?') && u.includes('key=TES-9'))).toBe(true);
    });

    test('a failed background refresh keeps the list and marks it stale', async () => {
        const store = makeStore();
        seedList(store);
        setRHSMounted(true);
        (global.fetch as jest.Mock).mockReset();
        (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve({ok: false, status: 500, text: () => Promise.resolve('boom')}));
        const handle = createRHSLiveHandler(store as any);

        handle(msg('TES-1'));
        await flushTimers();
        await Promise.resolve();

        const rhs = store.getState()[pluginStateKey].rhs;
        expect(rhs.issues).toHaveLength(1);
        expect(rhs.loading).toBe(false);
        expect(rhs.stale).toBe(true);
        expect(rhs.error).toBeNull();
    });
});
