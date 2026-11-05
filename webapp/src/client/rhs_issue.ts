// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    RHSAssignTarget,
    RHSIssueCard,
    RHSTransitionScreen,
    RHSTransitionValues,
    RHSUser,
} from 'types/rhs_issue';

import {rhsRequest} from './rhs';

import {buildQueryString} from './index';

function post<T>(url: string, body: object): Promise<T> {
    return rhsRequest<T>(url, {method: 'post', body: JSON.stringify(body)});
}

export function getRHSIssueCard(baseUrl: string, instanceID: string, key: string): Promise<RHSIssueCard> {
    return rhsRequest<RHSIssueCard>(`${baseUrl}/api/v2/rhs/issue${buildQueryString({instance_id: instanceID, key})}`);
}

export function transitionRHSIssue(baseUrl: string, instanceID: string, key: string, transitionID: string, values?: RHSTransitionValues): Promise<RHSIssueCard> {
    return post(`${baseUrl}/api/v2/rhs/issue/transition`, {instance_id: instanceID, key, transition_id: transitionID, ...values});
}

export function getRHSTransitionScreen(baseUrl: string, instanceID: string, key: string, transitionID: string): Promise<RHSTransitionScreen> {
    return rhsRequest<RHSTransitionScreen>(`${baseUrl}/api/v2/rhs/issue/transition/screen${buildQueryString({instance_id: instanceID, key, transition_id: transitionID})}`);
}

export function assignRHSIssue(baseUrl: string, instanceID: string, key: string, target: RHSAssignTarget): Promise<RHSIssueCard> {
    const body: {[k: string]: unknown} = {instance_id: instanceID, key};
    if ('user' in target) {
        body.assignee = {accountId: target.user.accountId, name: target.user.name, displayName: target.user.displayName};
    } else if ('me' in target) {
        body.assign_to_me = true;
    }
    return post(`${baseUrl}/api/v2/rhs/issue/assign`, body);
}

export function commentRHSIssue(baseUrl: string, instanceID: string, key: string, text: string): Promise<RHSIssueCard> {
    return post(`${baseUrl}/api/v2/rhs/issue/comment`, {instance_id: instanceID, key, body: text});
}

export function shareRHSIssue(baseUrl: string, instanceID: string, key: string, channelID: string): Promise<{post_id: string}> {
    return post(`${baseUrl}/api/v2/rhs/issue/share`, {instance_id: instanceID, key, channel_id: channelID});
}

export function searchRHSAssignableUsers(baseUrl: string, instanceID: string, key: string, query: string): Promise<RHSUser[]> {
    return rhsRequest<RHSUser[]>(`${baseUrl}/api/v2/rhs/users/assignable${buildQueryString({instance_id: instanceID, key, q: query})}`);
}
