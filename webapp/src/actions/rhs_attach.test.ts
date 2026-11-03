// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {InstanceType} from 'types/model';
import {pluginStateKey} from 'types/store';

import ActionTypes from '../action_types';
import reducer from '../reducers';
import {resetRHSPluginActions, setRHSPluginActions} from 'utils/rhs_controller';

import {attachPostToIssue, openRHSAttach, searchRHSAttachIssues} from './rhs_attach';

const instance = {instance_id: 'http://jira.example.com', type: InstanceType.SERVER};

function makeState() {
    let plugin = reducer({} as any, {type: '@@INIT'} as any);
    plugin = reducer(plugin, {type: ActionTypes.RECEIVED_INSTANCE_STATUS, data: {instances: [instance]}} as any);
    plugin = reducer(plugin, {
        type: ActionTypes.RECEIVED_CONNECTED,
        data: {can_connect: true, is_connected: true, user_info: {connected_instances: [instance], default_instance_id: instance.instance_id}},
    } as any);
    return {
        entities: {
            general: {config: {SiteURL: 'http://localhost:8065'}},
            teams: {currentTeamId: 't1', teams: {t1: {id: 't1', name: 'organization'}}},
        },
        [pluginStateKey]: plugin,
    };
}

function mockFetch(body: unknown, ok = true) {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve({
        ok,
        status: ok ? 200 : 400,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    }));
    return fetchMock;
}

describe('actions/rhs_attach', () => {
    afterEach(() => {
        resetRHSPluginActions();
    });

    test('openRHSAttach sets the post and opens the panel', () => {
        setRHSPluginActions({showRHSPlugin: {type: 'SHOW'}, hideRHSPlugin: {}, toggleRHSPlugin: {}});
        const dispatch = jest.fn();
        openRHSAttach('p1')(dispatch);
        expect(dispatch).toHaveBeenCalledWith({type: ActionTypes.OPEN_RHS_ATTACH, data: 'p1'});
        expect(dispatch).toHaveBeenCalledWith({type: 'SHOW'});
    });

    test('search uses the active instance and does not touch the list state', async () => {
        const fetchMock = mockFetch({issues: [], nextPageToken: '', isLast: true, total: 0});
        const dispatch = jest.fn();
        const result = await searchRHSAttachIssues('BACK-1')(dispatch, makeState as any);
        expect(result.data).toEqual({issues: [], total: 0, isLast: true});
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain('instance_id=' + encodeURIComponent(instance.instance_id));
        expect(url).toContain('q=BACK-1');
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('attach posts to the existing endpoint with team and instance', async () => {
        const fetchMock = mockFetch({id: 'c1'});
        const result = await attachPostToIssue('p1', 'BACK-409')(jest.fn(), makeState as any);
        expect(result.data).toEqual({id: 'c1'});
        const [url, options] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('/api/v2/attach-comment-to-issue');
        expect(JSON.parse(options.body)).toEqual({post_id: 'p1', issueKey: 'BACK-409', instance_id: instance.instance_id, current_team: 'organization'});
    });
});
