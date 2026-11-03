// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import ActionTypes from '../action_types';
import {RHSFetchError, getRHSIssues} from '../client/rhs';
import {getPluginServerRoute, getRHSActiveInstanceID} from '../selectors';

import {RHSIssue} from 'types/rhs';
import {GlobalState} from 'types/store';

import {openJiraRHS} from './rhs_nav';

import {attachCommentToIssue} from './index';

// openRHSAttach opens "Приложить к задаче" for a post in the panel.
export const openRHSAttach = (postId: string) => {
    return (dispatch: Dispatch) => {
        dispatch({type: ActionTypes.OPEN_RHS_ATTACH, data: postId});
        return openJiraRHS()(dispatch);
    };
};

export const closeRHSAttach = () => ({type: ActionTypes.CLOSE_RHS_ATTACH});

// searchRHSAttachIssues finds issues to attach to: the user's open issues for
// an empty query, otherwise a key, text or JQL search. Results are not
// stored, so the "Мои задачи" list stays as it was.
export const searchRHSAttachIssues = (query: string) => {
    return async (_dispatch: Dispatch, getState: () => GlobalState): Promise<{data?: {issues: RHSIssue[]; total: number | null; isLast: boolean}; error?: RHSFetchError}> => {
        const state = getState();
        try {
            const data = await getRHSIssues(getPluginServerRoute(state), {
                instanceID: getRHSActiveInstanceID(state),
                filter: 'assigned',
                query,
                sort: 'updated',
            });
            return {data: {issues: data.issues, total: data.total ?? null, isLast: data.isLast}};
        } catch (error) {
            return {error: error instanceof RHSFetchError ? error : new RHSFetchError('internal_error', String(error), 0)};
        }
    };
};

// attachPostToIssue adds the post as a Jira comment. The server also copies
// the post's files and replies in the thread with the issue link.
export const attachPostToIssue = (postId: string, issueKey: string) => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const state = getState();
        return attachCommentToIssue({
            post_id: postId,
            issueKey,
            instance_id: getRHSActiveInstanceID(state),
            current_team: getCurrentTeam(state)?.name || '',
        })(dispatch, getState as never);
    };
};
