// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {applyMiddleware, createStore} from 'redux';
import thunk from 'redux-thunk';

import {InstanceType} from 'types/model';
import {RHSIssue} from 'types/rhs';
import {pluginStateKey} from 'types/store';

import ActionTypes from '../action_types';
import reducer from '../reducers';
import {resetRHSPluginActions, setRHSPluginActions} from 'utils/rhs_controller';

import {
    assignRHSCard,
    commentRHSCard,
    openRHSIssue,
    shareRHSCard,
    transitionRHSCard,
} from './rhs_card';

const instance = {instance_id: 'http://jira.example.com', type: InstanceType.SERVER};

function makeStore() {
    const initialState = {
        entities: {
            general: {config: {SiteURL: 'http://localhost:8065'}},
            users: {currentUserId: 'user-1'},
        },
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
    return store;
}

function cardBody(key: string, statusName: string) {
    return {
        key,
        summary: 'Card ' + key,
        browseUrl: '',
        status: {name: statusName, categoryKey: 'indeterminate'},
        issueType: 'Task',
        project: 'TES',
        updated: '',
        assignee: null,
        reporter: null,
        labels: [],
        description: '',
        transitions: [],
        comments: [],
        commentsTotal: 0,
        me: {displayName: 'Me', name: 'me'},
    };
}

function mockResponses(...bodies: Array<{ok: boolean; status?: number; body: unknown}>) {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    for (const b of bodies) {
        fetchMock.mockImplementationOnce(() => Promise.resolve({
            ok: b.ok,
            status: b.status || 200,
            json: () => Promise.resolve(b.body),
            text: () => Promise.resolve(JSON.stringify(b.body)),
        }));
    }
    return fetchMock;
}

const state = (store: ReturnType<typeof makeStore>) => store.getState()[pluginStateKey];

describe('actions/rhs_card', () => {
    afterEach(() => {
        resetRHSPluginActions();
    });

    test('openRHSIssue opens the panel, sets the key and loads the card', async () => {
        const store = makeStore();
        setRHSPluginActions({showRHSPlugin: {type: 'SHOW'}, hideRHSPlugin: {}, toggleRHSPlugin: {}});
        const fetchMock = mockResponses({ok: true, body: cardBody('TES-1', 'Open')});

        await store.dispatch(openRHSIssue('tes-1') as any);

        expect(state(store).rhsNav.issueKey).toBe('TES-1');
        expect(state(store).rhsCard.data?.key).toBe('TES-1');
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain('/api/v2/rhs/issue?');
        expect(url).toContain('key=TES-1');
        expect(url).toContain('instance_id=' + encodeURIComponent(instance.instance_id));
    });

    test('a transition stores the returned card and updates the issue in the list', async () => {
        const store = makeStore();
        const listIssue: RHSIssue = {...cardBody('TES-1', 'Open'), status: {name: 'Open', categoryKey: 'new'}};
        store.dispatch({type: ActionTypes.RHS_ISSUES_LOADING, data: {reset: true}});
        store.dispatch({type: ActionTypes.RECEIVED_RHS_ISSUES, data: {issues: [listIssue], isLast: true}, requestId: state(store).rhs.requestId});

        mockResponses({ok: true, body: cardBody('TES-1', 'Open')}, {ok: true, body: cardBody('TES-1', 'In Progress')});
        await store.dispatch(openRHSIssue('TES-1') as any);
        const fetchMock = global.fetch as jest.Mock;

        await store.dispatch(transitionRHSCard('21') as any);

        const [url, options] = fetchMock.mock.calls[1];
        expect(String(url)).toContain('/api/v2/rhs/issue/transition');
        expect(JSON.parse(options.body)).toEqual({instance_id: instance.instance_id, key: 'TES-1', transition_id: '21'});
        expect(state(store).rhsCard.data?.status.name).toBe('In Progress');
        expect(state(store).rhs.issues[0].status.name).toBe('In Progress');
        expect(state(store).rhsCard.pending).toBeNull();
    });

    test('a rejected action keeps the card and shows Jira message', async () => {
        const store = makeStore();
        mockResponses(
            {ok: true, body: cardBody('TES-1', 'Open')},
            {ok: false, status: 400, body: {error: 'jira_rejected', message: 'Resolution is required.'}},
        );
        await store.dispatch(openRHSIssue('TES-1') as any);
        const result = await store.dispatch(transitionRHSCard('31') as any);

        expect(result.error.errorCode).toBe('jira_rejected');
        expect(state(store).rhsCard.actionError).toBe('jira_rejected');
        expect(state(store).rhsCard.actionErrorMessage).toBe('Resolution is required.');
        expect(state(store).rhsCard.data?.status.name).toBe('Open');
    });

    test('assign, comment and share send the expected bodies', async () => {
        const store = makeStore();
        const fetchMock = mockResponses(
            {ok: true, body: cardBody('TES-1', 'Open')},
            {ok: true, body: cardBody('TES-1', 'Open')},
            {ok: true, body: cardBody('TES-1', 'Open')},
            {ok: true, body: cardBody('TES-1', 'Open')},
            {ok: true, body: {post_id: 'p1'}},
        );
        await store.dispatch(openRHSIssue('TES-1') as any);

        await store.dispatch(assignRHSCard({me: true}) as any);
        await store.dispatch(assignRHSCard({nobody: true}) as any);
        await store.dispatch(commentRHSCard('Готово') as any);
        const shared = await store.dispatch(shareRHSCard('channel-1') as any);

        const bodies = fetchMock.mock.calls.slice(1).map(([, options]) => JSON.parse(options.body));
        expect(bodies[0]).toEqual({instance_id: instance.instance_id, key: 'TES-1', assign_to_me: true});
        expect(bodies[1]).toEqual({instance_id: instance.instance_id, key: 'TES-1'});
        expect(bodies[2]).toEqual({instance_id: instance.instance_id, key: 'TES-1', body: 'Готово'});
        expect(bodies[3]).toEqual({instance_id: instance.instance_id, key: 'TES-1', channel_id: 'channel-1'});
        expect(shared.data).toEqual({post_id: 'p1'});
        expect(state(store).rhsCard.pending).toBeNull();
    });
});
