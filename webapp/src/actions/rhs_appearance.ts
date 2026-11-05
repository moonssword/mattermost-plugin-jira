// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Dispatch} from 'redux';

import {doFetch} from '../client';
import {RHS_PREFERENCE_CATEGORY} from '../selectors';

import {GlobalState} from 'types/store';

// Mattermost's own action type: the webapp stores the preference and the
// plugin reads it from there.
const RECEIVED_PREFERENCES = 'RECEIVED_PREFERENCES';

export const saveRHSAppearance = (name: string, value: string) => {
    return async (dispatch: Dispatch, getState: () => GlobalState) => {
        const userID = (getState().entities as unknown as {users: {currentUserId: string}}).users.currentUserId;
        const preference = {user_id: userID, category: RHS_PREFERENCE_CATEGORY, name, value};
        try {
            await doFetch(`/api/v4/users/${userID}/preferences`, {method: 'put', body: JSON.stringify([preference])});
        } catch (error) {
            return {error};
        }
        dispatch({type: RECEIVED_PREFERENCES, data: [preference]});
        return {data: true};
    };
};
