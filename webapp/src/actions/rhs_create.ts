// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import ActionTypes from '../action_types';

import {summaryFromMessage} from 'utils/rhs_create';
import {GlobalState} from 'types/store';

import {openJiraRHS} from './rhs_nav';

export type OpenRHSCreateArgs = {
    postId?: string;
    description?: string;
};

// openRHSCreate opens the "Создать" section, prefilled from a post when one
// is given: the first line becomes the summary, the full text the description.
export const openRHSCreate = (args: OpenRHSCreateArgs = {}) => {
    return (dispatch: Dispatch, getState: () => GlobalState) => {
        const post = args.postId ? getPost(getState(), args.postId) : null;
        const message = post ? post.message : (args.description || '');
        dispatch({
            type: ActionTypes.SET_RHS_CREATE,
            data: {
                postId: post ? post.id : '',
                summary: summaryFromMessage(message),
                description: message,
            },
        });
        return openJiraRHS('create')(dispatch);
    };
};

export const clearRHSCreate = () => ({type: ActionTypes.CLEAR_RHS_CREATE});
