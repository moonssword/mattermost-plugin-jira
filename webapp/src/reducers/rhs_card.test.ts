// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ActionTypes from '../action_types';

import {RHSIssueCard} from 'types/rhs_issue';

import rhsCard, {defaultRHSCardState} from './rhs_card';
import rhsNav from './rhs_nav';

function card(key: string, status = 'Open'): RHSIssueCard {
    return {
        key,
        summary: key,
        browseUrl: '',
        status: {name: status, categoryKey: 'new'},
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

describe('reducers/rhs_card', () => {
    test('loading a new key drops the old card; reloading the same key keeps it', () => {
        let state = rhsCard(defaultRHSCardState, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-1'});
        state = rhsCard(state, {type: ActionTypes.RECEIVED_RHS_CARD, data: card('TES-1'), requestId: state.requestId});
        expect(state.data?.key).toBe('TES-1');

        const reload = rhsCard(state, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-1'});
        expect(reload.data?.key).toBe('TES-1');
        expect(reload.loading).toBe(true);

        const other = rhsCard(state, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-2'});
        expect(other.data).toBeNull();
    });

    test('a stale response for another key or request is ignored', () => {
        let state = rhsCard(defaultRHSCardState, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-1'});
        const first = state.requestId;
        state = rhsCard(state, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-2'});
        expect(rhsCard(state, {type: ActionTypes.RECEIVED_RHS_CARD, data: card('TES-1'), requestId: first})).toBe(state);
        expect(rhsCard(state, {type: ActionTypes.RECEIVED_RHS_CARD, data: card('TES-2'), requestId: first})).toBe(state);
        expect(rhsCard(state, {type: ActionTypes.RHS_CARD_ERROR, key: 'TES-2', requestId: first, data: 'not_found'})).toBe(state);
    });

    test('actions mark the card busy and keep the data on failure', () => {
        let state = rhsCard(defaultRHSCardState, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-1'});
        state = rhsCard(state, {type: ActionTypes.RECEIVED_RHS_CARD, data: card('TES-1'), requestId: state.requestId});
        state = rhsCard(state, {type: ActionTypes.RHS_CARD_ACTION_STARTED, key: 'TES-1', data: 'transition'});
        expect(state.pending).toBe('transition');

        state = rhsCard(state, {type: ActionTypes.RHS_CARD_ACTION_FAILED, key: 'TES-1', data: 'jira_rejected', message: 'Resolution is required.'});
        expect(state.pending).toBeNull();
        expect(state.actionError).toBe('jira_rejected');
        expect(state.data?.key).toBe('TES-1');

        state = rhsCard(state, {type: ActionTypes.RECEIVED_RHS_CARD, data: card('TES-1', 'Done')});
        expect(state.actionError).toBeNull();
        expect(state.data?.status.name).toBe('Done');
    });

    test('closing the card clears it', () => {
        let state = rhsCard(defaultRHSCardState, {type: ActionTypes.RHS_CARD_LOADING, data: 'TES-1'});
        state = rhsCard(state, {type: ActionTypes.CLOSE_RHS_ISSUE});
        expect(state.key).toBe('');
        expect(state.data).toBeNull();
    });
});

describe('reducers/rhs_nav issue key', () => {
    test('opening and closing a card, and switching sections closes it', () => {
        let state = rhsNav({section: 'my_issues', issueKey: '', attachPostId: ''}, {type: ActionTypes.OPEN_RHS_ISSUE, data: 'TES-1'});
        expect(state.issueKey).toBe('TES-1');
        state = rhsNav(state, {type: ActionTypes.SET_RHS_SECTION, data: 'my_issues'});
        expect(state.issueKey).toBe('');

        state = rhsNav(state, {type: ActionTypes.OPEN_RHS_ISSUE, data: 'TES-2'});
        state = rhsNav(state, {type: ActionTypes.CLOSE_RHS_ISSUE});
        expect(state.issueKey).toBe('');
    });
});

describe('reducers/rhs_nav attach', () => {
    const base = {section: 'my_issues' as const, issueKey: '', attachPostId: ''};

    test('attach view replaces an open card and closes on section change', () => {
        let state = rhsNav({...base, issueKey: 'TES-1'}, {type: ActionTypes.OPEN_RHS_ATTACH, data: 'p1'});
        expect(state).toEqual({...base, attachPostId: 'p1'});

        state = rhsNav(state, {type: ActionTypes.SET_RHS_SECTION, data: 'my_issues'});
        expect(state.attachPostId).toBe('');
    });

    test('opening a card from the attach view leaves it', () => {
        const state = rhsNav({...base, attachPostId: 'p1'}, {type: ActionTypes.OPEN_RHS_ISSUE, data: 'TES-2'});
        expect(state).toEqual({...base, issueKey: 'TES-2'});
        expect(rhsNav(state, {type: ActionTypes.CLOSE_RHS_ATTACH})).toBe(state);
    });
});
