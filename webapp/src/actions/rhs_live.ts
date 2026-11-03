// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnyAction, Dispatch} from 'redux';

import ActionTypes from '../action_types';
import {getRHSActiveInstanceID} from '../selectors';

import {isRHSMounted} from 'utils/rhs_controller';
import {GlobalState, pluginStateKey} from 'types/store';

import {refreshRHSIssuesInPlace} from './rhs';
import {fetchRHSBoard} from './rhs_board';
import {fetchRHSIssueCard} from './rhs_card';

// Bursts of webhook events (a transition plus a comment) arrive together;
// one reload per burst is enough.
export const RHS_LIVE_DELAY_MS = 1500;

type LiveStore = {
    dispatch: (action: AnyAction | ((dispatch: Dispatch, getState: () => GlobalState) => unknown)) => unknown;
    getState: () => unknown;
};

type IssueChangedMessage = {
    data?: {
        instance_id?: string;
        issue_key?: string;
    };
};

export {refreshRHSIssuesInPlace};

export function createRHSLiveHandler(store: LiveStore, delayMs = RHS_LIVE_DELAY_MS) {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
        timer = null;
        const keys = new Set(pending);
        pending.clear();

        const state = store.getState() as GlobalState;
        const plugin = state[pluginStateKey];

        const cardKey = plugin.rhsNav.issueKey;
        if (cardKey && keys.has(cardKey) && plugin.rhsCard.pending === null) {
            store.dispatch(fetchRHSIssueCard(cardKey));
        }

        if (!plugin.rhs.instanceID) {
            return;
        }
        if (isRHSMounted() && !plugin.rhs.loading) {
            store.dispatch(refreshRHSIssuesInPlace());
            store.dispatch(fetchRHSBoard());
        } else {
            store.dispatch({type: ActionTypes.RHS_ISSUES_STALE});
        }
    };

    // The websocket handler for custom_jira_rhs_issue_changed.
    return (msg: IssueChangedMessage) => {
        const key = msg?.data?.issue_key;
        const instanceID = msg?.data?.instance_id;
        if (!key || !instanceID) {
            return;
        }
        if (instanceID !== getRHSActiveInstanceID(store.getState() as GlobalState)) {
            return;
        }
        pending.add(key);
        if (!timer) {
            timer = setTimeout(flush, delayMs);
        }
    };
}
