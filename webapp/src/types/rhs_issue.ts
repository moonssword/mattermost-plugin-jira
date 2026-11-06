// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {JiraField} from './model';

import {RHSErrorCode, RHSIssue, RHSIssueStatus} from './rhs';

// A Jira user. Cloud identifies users by accountId, Server/DC by name.
export type RHSUser = {
    accountId?: string;
    name?: string;
    displayName: string;

    // An uploaded picture served by the plugin; none means initials.
    avatarUrl?: string;
};

export type RHSTransition = {
    id: string;
    name: string;
    to: RHSIssueStatus;
};

export type RHSComment = {
    id: string;
    author: RHSUser;

    // Markdown converted from Jira wiki markup by the server.
    body: string;
    created: string;
};

export type RHSAttachment = {
    id: string;
    name: string;
    url: string;
    image: boolean;
};

export type RHSIssueCard = RHSIssue & {
    projectName?: string;
    assignee: RHSUser | null;
    reporter: RHSUser | null;
    labels: string[];
    description: string;
    transitions: RHSTransition[];
    comments: RHSComment[];
    attachments?: RHSAttachment[];
    commentsTotal: number;
    me: RHSUser;
};

// Screen of a transition: no fields means Jira shows no form for it.
export type RHSTransitionScreen = {
    fields: {[key: string]: JiraField};
};

export type RHSTransitionValues = {
    fields: {[key: string]: unknown};
    comment: string;
};

// Card actions that change the issue; only one runs at a time.
export type RHSCardAction = 'transition' | 'assign' | 'comment' | 'share';

// Who to assign: a user, the current user, or nobody.
export type RHSAssignTarget = {user: RHSUser} | {me: true} | {nobody: true};

export type RHSCardState = {
    key: string;
    data: RHSIssueCard | null;
    loading: boolean;
    error: RHSErrorCode | null;
    errorMessage: string;
    pending: RHSCardAction | null;
    actionError: RHSErrorCode | null;
    actionErrorMessage: string;
    requestId: number;

    // Transition chosen outside the card, on the board: the card opens its form.
    requestedTransition: string;
};

export function isSameRHSUser(a: RHSUser | null | undefined, b: RHSUser | null | undefined): boolean {
    if (!a || !b) {
        return false;
    }
    if (a.accountId && b.accountId) {
        return a.accountId === b.accountId;
    }
    return Boolean(a.name) && a.name === b.name;
}
